/* Multi-segment survey project — MV/LV lines + TR installs */
(function () {
  const SEGMENT_COLORS = {
    mv: "#71e8ff",
    lv: "#3ecf6e"
  };

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function createLineSegment(type, phase, spanM, label) {
    const voltageType = type === "mv" ? "mv" : "lv";
    return {
      id: makeId("seg"),
      kind: "line",
      type: voltageType,
      phase,
      label: label || `${type.toUpperCase()} ${phase.toUpperCase()}`,
      color: SEGMENT_COLORS[voltageType] || "#71e8ff",
      selectedSpan: spanM,
      controlPoints: [],
      poles: [],
      routedPaths: [],
      routedLegs: [],
      routeCache: {},
      defaults: {
        straight: { poleMaterialId: "", headMaterialId: "", cableMaterialId: "", ohgwSetId: "", ohgwInstall: false },
        curve: { poleMaterialId: "", headMaterialId: "", cableMaterialId: "", ohgwSetId: "", ohgwInstall: false }
      },
      startFromTrInstallId: ""
    };
  }

  function createTrInstall(data) {
    return {
      id: makeId("tr"),
      hostPoleId: data.hostPoleId || "",
      segmentId: data.segmentId || "",
      lat: data.lat,
      lng: data.lng,
      label: data.label || "TR",
      isExistingPole: Boolean(data.isExistingPole),
      installType: data.installType || "singlePole",
      phase: data.phase || "3p",
      trSetId: data.trSetId || "",
      transformerId: data.transformerId || "",
      lvBranchSegmentIds: data.lvBranchSegmentIds || []
    };
  }

  function saveWorkspaceToSegment(segment, workspace) {
    if (!segment || segment.kind !== "line") return;
    segment.controlPoints = JSON.parse(JSON.stringify(workspace.controlPoints));
    segment.poles = JSON.parse(JSON.stringify(workspace.poles));
    segment.routedPaths = JSON.parse(JSON.stringify(workspace.routedPaths));
    segment.routedLegs = JSON.parse(JSON.stringify(workspace.routedLegs));
    segment.routeCache = JSON.parse(JSON.stringify(workspace.routeCache));
    segment.defaults = JSON.parse(JSON.stringify(workspace.defaults));
    segment.selectedSpan = workspace.selectedSpan;
  }

  function loadSegmentToWorkspace(segment, workspace) {
    if (!segment || segment.kind !== "line") {
      workspace.controlPoints = [];
      workspace.poles = [];
      workspace.routedPaths = [];
      workspace.routedLegs = [];
      workspace.routeCache = {};
      workspace.selectedSpan = workspace.selectedSpan || 40;
      return;
    }
    workspace.controlPoints = JSON.parse(JSON.stringify(segment.controlPoints));
    workspace.poles = JSON.parse(JSON.stringify(segment.poles));
    workspace.routedPaths = JSON.parse(JSON.stringify(segment.routedPaths));
    workspace.routedLegs = JSON.parse(JSON.stringify(segment.routedLegs));
    workspace.routeCache = JSON.parse(JSON.stringify(segment.routeCache || {}));
    workspace.defaults = JSON.parse(JSON.stringify(segment.defaults));
    workspace.selectedSpan = segment.selectedSpan;
    workspace.voltageType = segment.type;
    workspace.phaseType = segment.phase;
  }

  function findPoleById(project, poleId) {
    for (const seg of project.segments) {
      const pole = seg.poles?.find(p => p.id === poleId);
      if (pole) return { pole, segment: seg };
    }
    return null;
  }

  function addSetToCounts(counts, presetsApi, setId, multiplier, skipIds) {
    const setObj = presetsApi.getSet(setId);
    if (!setObj) return;
    const skip = new Set(skipIds || []);
    setObj.items.forEach(item => {
      if (skip.has(item.id)) return;
      const key = `mat:${item.id}`;
      counts[key] = (counts[key] || 0) + (item.qty * multiplier);
    });
  }

  function addMaterial(counts, materialId, qty) {
    if (!materialId || !qty) return;
    const key = `mat:${materialId}`;
    counts[key] = (counts[key] || 0) + qty;
  }

  function buildProjectBom(project, helpers) {
    const counts = {};
    const {
      presetsApi,
      distanceMeters,
      getSpecialPoleKind,
      getSpecialPoleRule,
      getSpecialPoleRulesRoot
    } = helpers;

    project.segments.filter(s => s.kind === "line").forEach(segment => {
      const config = presetsApi.getConfig(segment.type, segment.phase);
      const wireMult = config?.wireMultiplier || 1;
      const poles = segment.poles || [];

      poles.forEach((pole, index) => {
        pole.segmentId = segment.id;
        if (pole.source !== "start" && pole.poleMaterialId) {
          addMaterial(counts, pole.poleMaterialId, 1);
        }
        if (pole.headMaterialId) {
          addSetToCounts(counts, presetsApi, pole.headMaterialId, 1);
        }
        if (index > 0 && pole.cableMaterialId) {
          const span = distanceMeters(poles[index - 1], pole);
          const key = `cable:${pole.cableMaterialId}`;
          counts[key] = (counts[key] || 0) + (span * wireMult);
        }
        if (pole.ohgwSetId) {
          addSetToCounts(counts, presetsApi, pole.ohgwSetId, 1);
        }
        if (pole.guySetId) {
          addSetToCounts(counts, presetsApi, pole.guySetId, 1);
        }
        if (pole.concreteMaterialId && pole.concreteQty) {
          addMaterial(counts, pole.concreteMaterialId, pole.concreteQty);
        }
        if (pole.groundingSetId) {
          addSetToCounts(counts, presetsApi, pole.groundingSetId, 1);
        }
        if (pole.surgeSetId) {
          addSetToCounts(counts, presetsApi, pole.surgeSetId, 1);
        }
        if (pole.surgeArresterId && pole.surgeArresterQty) {
          addMaterial(counts, pole.surgeArresterId, pole.surgeArresterQty);
        }
      });

      if (segment.type === "lv") {
        const rules = presetsApi.getSpecialPoleRules(presetsApi.getConfigKey("lv", segment.phase));
        const intervalM = rules?.surgeIntervalM;
        const setId = rules?.intervalSurgeSetId;
        if (intervalM && setId && poles.length > 1) {
          let traveled = 0;
          let nextAt = intervalM;
          for (let i = 1; i < poles.length; i++) {
            const segLen = distanceMeters(poles[i - 1], poles[i]);
            while (traveled + segLen >= nextAt) {
              addSetToCounts(counts, presetsApi, setId, 1);
              nextAt += intervalM;
            }
            traveled += segLen;
          }
        }
      }
    });

    (project.trInstalls || []).forEach(tr => {
      if (tr.trSetId) {
        const skip = tr.isExistingPole ? (presetsApi.getSet(tr.trSetId)?.skipOnExistingHost || []) : [];
        addSetToCounts(counts, presetsApi, tr.trSetId, 1, skip);
      }
      if (tr.transformerId) {
        addMaterial(counts, tr.transformerId, 1);
      }
    });

    return counts;
  }

  function buildProjectJunctions(project) {
    const junctions = [];

    (project.trInstalls || []).forEach(tr => {
      const branchIds = tr.lvBranchSegmentIds || [];
      const branchLabels = branchIds.map(id => {
        const seg = project.segments.find(s => s.id === id);
        return seg?.label || id;
      });
      junctions.push({
        id: tr.id,
        type: "tr",
        label: tr.label || "TR",
        lat: tr.lat,
        lng: tr.lng,
        trSetId: tr.trSetId || "",
        transformerId: tr.transformerId || "",
        isExistingPole: Boolean(tr.isExistingPole),
        hostPoleId: tr.hostPoleId || "",
        lvBranchCount: branchIds.length,
        lvBranchLabels: branchLabels,
        connectedSegmentIds: [tr.segmentId, ...branchIds].filter(Boolean)
      });
    });

    project.segments.filter(s => s.kind === "line" && s.startFromTrInstallId).forEach(seg => {
      const tr = project.trInstalls.find(t => t.id === seg.startFromTrInstallId);
      junctions.push({
        id: `lv-branch-${seg.id}`,
        type: "lv_branch",
        label: `${seg.label} ← TR`,
        lat: tr?.lat,
        lng: tr?.lng,
        trInstallId: seg.startFromTrInstallId,
        segmentId: seg.id,
        segmentLabel: seg.label
      });
    });

    return junctions;
  }

  function computeSurveyPoleStats(project) {
    const stats = {
      startPoles: 0,
      straightRun: 0,
      curveEntryExit: 0,
      curveInterior: 0,
      endPoles: 0,
      guySets: 0
    };

    project.segments.filter(s => s.kind === "line").forEach(segment => {
      (segment.poles || []).forEach(pole => {
        const source = pole.source;
        // "control" = หมุดที่ผู้ใช้ปักเองระหว่างทาง (ไม่ใช่ต้นสุดท้าย) — เป็นเสาใหม่เหมือน "auto"
        // ถ้าไม่นับตรงนี้ ยอดในแผงสรุปจะน้อยกว่าจำนวนเสาที่ปักจริง
        const isRunPole = source === "auto" || source === "control";
        if (source === "start") {
          stats.startPoles += 1;
        } else if (source === "end") {
          stats.endPoles += 1;
        } else if (source === "curve_in" || source === "curve_out") {
          stats.curveEntryExit += 1;
        } else if (source === "curve_waypoint" || (isRunPole && pole.section === "curve")) {
          stats.curveInterior += 1;
        } else if (isRunPole) {
          stats.straightRun += 1;
        }
        if (pole.guySetId) stats.guySets += 1;
      });
    });

    return stats;
  }

  function collectSetUsageFromProject(project, presetsApi, distanceMeters) {
    const usage = {};

    function bump(setId, qty = 1) {
      if (!setId || qty <= 0) return;
      if (!usage[setId]) {
        const setObj = presetsApi?.getSet?.(setId);
        usage[setId] = {
          setId,
          qty: 0,
          name: setObj?.name || setObj?.label || setId
        };
      }
      usage[setId].qty += qty;
    }

    project.segments.filter(s => s.kind === "line").forEach(segment => {
      const poles = segment.poles || [];
      poles.forEach(pole => {
        if (pole.headMaterialId) bump(pole.headMaterialId, 1);
        if (pole.ohgwSetId) bump(pole.ohgwSetId, 1);
        if (pole.guySetId) bump(pole.guySetId, 1);
        if (pole.groundingSetId) bump(pole.groundingSetId, 1);
        if (pole.surgeSetId) bump(pole.surgeSetId, 1);
      });

      if (segment.type === "lv" && typeof distanceMeters === "function") {
        const rules = presetsApi?.getSpecialPoleRules?.(
          presetsApi.getConfigKey("lv", segment.phase)
        );
        const intervalM = rules?.surgeIntervalM;
        const setId = rules?.intervalSurgeSetId;
        if (intervalM && setId && poles.length > 1) {
          let traveled = 0;
          let nextAt = intervalM;
          for (let i = 1; i < poles.length; i++) {
            const segLen = distanceMeters(poles[i - 1], poles[i]);
            while (traveled + segLen >= nextAt) {
              bump(setId, 1);
              nextAt += intervalM;
            }
            traveled += segLen;
          }
        }
      }
    });

    (project.trInstalls || []).forEach(tr => {
      if (tr.trSetId) bump(tr.trSetId, 1);
    });

    return Object.values(usage).sort((a, b) => String(a.setId).localeCompare(String(b.setId)));
  }

  function buildMaterialSetLookup(setUsage, presetsApi) {
    const lookup = {};
    (setUsage || []).forEach(entry => {
      const setObj = presetsApi?.getSet?.(entry.setId);
      (setObj?.items || []).forEach(item => {
        const matId = String(item.id || "").trim();
        if (!matId) return;
        if (!lookup[matId]) lookup[matId] = [];
        if (!lookup[matId].includes(entry.setId)) lookup[matId].push(entry.setId);
      });
    });
    return lookup;
  }

  function buildGlobalMaterialSetLookup() {
    const lookup = {};
    const sets = window.SURVEY_PRESETS?.sets || {};
    Object.keys(sets).forEach(setId => {
      (sets[setId]?.items || []).forEach(item => {
        const matId = String(item.id || "").trim();
        if (!matId) return;
        if (!lookup[matId]) lookup[matId] = [];
        if (!lookup[matId].includes(setId)) lookup[matId].push(setId);
      });
    });
    return lookup;
  }

  function resolveMaterialSetIds(materialId, setUsage, presetsApi) {
    const id = String(materialId || "").trim();
    if (!id) return [];
    const fromProject = buildMaterialSetLookup(setUsage, presetsApi)[id] || [];
    if (fromProject.length) return fromProject;
    return buildGlobalMaterialSetLookup()[id] || [];
  }

  function qtyNearEqual(actual, expected, tolerance = 0.02) {
    const a = parseFloat(actual) || 0;
    const e = parseFloat(expected) || 0;
    if (e === 0) return Math.abs(a) <= tolerance;
    return Math.abs(a - e) <= Math.max(tolerance, Math.abs(e) * tolerance);
  }

  function inferSetUsageFromDetails(details, presetsApi) {
    const qtyById = {};
    (details || []).forEach(detail => {
      const id = String(detail.id || detail.materialId || "").trim();
      if (!id) return;
      qtyById[id] = (qtyById[id] || 0) + (parseFloat(detail.qty) || 0);
    });

    const remaining = { ...qtyById };
    const sets = window.SURVEY_PRESETS?.sets || {};
    const setList = Object.keys(sets)
      .map(id => sets[id])
      .filter(setObj => setObj?.items?.length)
      .sort((a, b) => {
        const diff = (b.items?.length || 0) - (a.items?.length || 0);
        return diff !== 0 ? diff : String(a.id).localeCompare(String(b.id));
      });

    const usage = [];

    let changed = true;
    while (changed) {
      changed = false;
      for (const setObj of setList) {
        const items = setObj.items || [];
        if (!items.length) continue;

        const allPresent = items.every(item => {
          const id = String(item.id || "").trim();
          return (remaining[id] || 0) > 0.0001;
        });
        if (!allPresent) continue;

        const ratios = items.map(item => {
          const id = String(item.id || "").trim();
          const perSetQty = parseFloat(item.qty) || 1;
          return remaining[id] / perSetQty;
        });
        const setQty = Math.min(...ratios);
        if (setQty <= 0.0001) continue;

        const maxRatio = Math.max(...ratios);
        let roundedQty = 0;
        if (setQty > 0.0001 && (qtyNearEqual(maxRatio, setQty, 0.03) || maxRatio / setQty <= 1.03)) {
          roundedQty = Math.round(setQty * 1000) / 1000;
        } else if (items.length >= 2) {
          // โครงการเก่า / qty ใน DB ไม่ตรง ratio — ถ้าครบทุกรหัสในชุด ให้ถือว่า 1 ชุด
          roundedQty = 1;
        }
        if (roundedQty <= 0) continue;
        usage.push({
          setId: String(setObj.id),
          qty: roundedQty,
          name: setObj.name || setObj.label || setObj.id,
          inferred: true
        });

        items.forEach(item => {
          const id = String(item.id || "").trim();
          const perSetQty = parseFloat(item.qty) || 0;
          remaining[id] = (remaining[id] || 0) - perSetQty * roundedQty;
          if (remaining[id] <= 0.0001) delete remaining[id];
        });

        changed = true;
        break;
      }
    }

    return usage.sort((a, b) => String(a.setId).localeCompare(String(b.setId)));
  }

  function buildSurveyMetaV2(project, helpers) {
    const lineSegs = project.segments.filter(s => s.kind === "line");
    const allPoles = lineSegs.flatMap(s => s.poles || []);
    const totalDist = lineSegs.reduce((sum, seg) => {
      const poles = seg.poles || [];
      for (let i = 1; i < poles.length; i++) {
        sum += helpers.distanceMeters(poles[i - 1], poles[i]);
      }
      return sum;
    }, 0);

    const first = allPoles[0];
    const last = allPoles[allPoles.length - 1];

    const junctions = buildProjectJunctions(project);

    return {
      version: 2,
      segmentCount: project.segments.length,
      trCount: (project.trInstalls || []).length,
      junctionCount: junctions.length,
      poleCount: allPoles.length,
      totalDistanceM: Math.round(totalDist),
      startLat: first?.lat,
      startLng: first?.lng,
      endLat: last?.lat,
      endLng: last?.lng,
      segments: project.segments.map(s => ({
        id: s.id,
        kind: s.kind,
        type: s.type,
        phase: s.phase,
        label: s.label,
        color: s.color,
        poleCount: s.poles?.length || 0,
        spanM: s.selectedSpan,
        startFromTrInstallId: s.startFromTrInstallId || "",
        distanceM: (() => {
          const poles = s.poles || [];
          let d = 0;
          for (let i = 1; i < poles.length; i++) {
            d += helpers.distanceMeters(poles[i - 1], poles[i]);
          }
          return Math.round(d);
        })()
      })),
      trInstalls: (project.trInstalls || []).map(t => ({
        id: t.id,
        label: t.label,
        lat: t.lat,
        lng: t.lng,
        trSetId: t.trSetId,
        transformerId: t.transformerId,
        isExistingPole: t.isExistingPole,
        hostPoleId: t.hostPoleId,
        lvBranchSegmentIds: t.lvBranchSegmentIds || []
      })),
      junctions,
      poleStats: computeSurveyPoleStats(project),
      setUsage: helpers.presetsApi
        ? collectSetUsageFromProject(project, helpers.presetsApi, helpers.distanceMeters)
        : [],
      capturedAt: new Date().toISOString()
    };
  }

  function escapeXml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kmlCoordinates(points) {
    return points.map(p => `${p.lng},${p.lat},0`).join(" ");
  }

  function buildProjectKml(project, options = {}) {
    const projectName = options.projectName || "PEA Survey";
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2">',
      "<Document>",
      `<name>${escapeXml(projectName)}</name>`,
      `<description>${escapeXml(options.description || "Exported from PEA Estimation AI Pro")}</description>`
    ];

    project.segments.filter(s => s.kind === "line").forEach(seg => {
      lines.push("<Folder>");
      lines.push(`<name>${escapeXml(seg.label)} (${seg.type.toUpperCase()} ${seg.phase.toUpperCase()})</name>`);

      (seg.controlPoints || []).forEach((cp, i) => {
        const role = cp.role || "control";
        lines.push("<Placemark>");
        lines.push(`<name>${escapeXml(`Ctrl ${i} — ${role}`)}</name>`);
        lines.push(`<description>${escapeXml(`Segment: ${seg.label}, role: ${role}`)}</description>`);
        lines.push("<Point><coordinates>");
        lines.push(`${cp.lng},${cp.lat},0`);
        lines.push("</coordinates></Point></Placemark>");
      });

      (seg.poles || []).forEach(pole => {
        lines.push("<Placemark>");
        lines.push(`<name>${escapeXml(pole.label || "Pole")}</name>`);
        lines.push(`<description>${escapeXml(`source: ${pole.source || ""}, segment: ${seg.label}`)}</description>`);
        lines.push("<Point><coordinates>");
        lines.push(`${pole.lng},${pole.lat},0`);
        lines.push("</coordinates></Point></Placemark>");
      });

      if ((seg.poles || []).length > 1) {
        lines.push("<Placemark>");
        lines.push(`<name>${escapeXml(seg.label + " — pole span line")}</name>`);
        lines.push("<LineString><tessellate>1</tessellate><coordinates>");
        lines.push(kmlCoordinates(seg.poles));
        lines.push("</coordinates></LineString></Placemark>");
      }

      (seg.routedPaths || []).forEach((path, pathIdx) => {
        if (!path || path.length < 2) return;
        lines.push("<Placemark>");
        lines.push(`<name>${escapeXml(seg.label + " — routed path " + (pathIdx + 1))}</name>`);
        lines.push("<LineString><tessellate>1</tessellate><coordinates>");
        lines.push(kmlCoordinates(path));
        lines.push("</coordinates></LineString></Placemark>");
      });

      lines.push("</Folder>");
    });

    if (project.trInstalls?.length) {
      lines.push("<Folder><name>TR Installs</name>");
      project.trInstalls.forEach(tr => {
        lines.push("<Placemark>");
        lines.push(`<name>${escapeXml(tr.label || "TR")}</name>`);
        lines.push(`<description>${escapeXml(`SET ${tr.trSetId}, TX ${tr.transformerId}`)}</description>`);
        lines.push("<Point><coordinates>");
        lines.push(`${tr.lng},${tr.lat},0`);
        lines.push("</coordinates></Point></Placemark>");
      });
      lines.push("</Folder>");
    }

    lines.push("</Document></kml>");
    return lines.join("\n");
  }

  window.SurveyProject = {
    SEGMENT_COLORS,
    makeId,
    createLineSegment,
    createTrInstall,
    saveWorkspaceToSegment,
    loadSegmentToWorkspace,
    findPoleById,
    buildProjectBom,
    buildSurveyMetaV2,
    buildProjectKml,
    buildProjectJunctions,
    computeSurveyPoleStats,
    collectSetUsageFromProject,
    buildMaterialSetLookup,
    buildGlobalMaterialSetLookup,
    resolveMaterialSetIds,
    inferSetUsageFromDetails
  };
})();
