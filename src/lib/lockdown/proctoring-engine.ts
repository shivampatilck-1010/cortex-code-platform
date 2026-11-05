/**
 * CORTEX LOCKDOWN - ALPHA 29 INTELLIGENT PROCTORING & SPECTRAL AUDIO ENGINE
 *
 * Privacy-preserving, client-side heuristic computer vision, spectral audio analysis,
 * false-positive suppression, and explainable behavioral scoring for university desktop exams.
 *
 * Absolute Constraints:
 * 1. 100% Client-Side Processing: Zero raw video frames or audio buffers are transmitted or saved.
 * 2. No Facial Identification: Analyzes face presence and count; never identifies identity.
 * 3. Human-in-the-Loop: Heuristic telemetry signals are advisory indicators for faculty review,
 *    never automated academic misconduct penalties.
 * 4. Zero Additional Budget: Pure mathematical heuristics and native Web APIs; zero paid dependencies.
 *
 * Strictly zero emojis.
 */

export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export type VisionQualityRating = 'optimal' | 'low_light' | 'extreme_backlight' | 'low_contrast' | 'obstructed';

export interface VisionAnalysisResult {
  faceCount: number;
  faces: DetectedFace[];
  status: 'absent' | 'verified' | 'multiple' | 'partial_visibility';
  method: 'native-shape-detector' | 'chrominance-aspect-clustering' | 'synthetic-simulation' | 'none';
  lightingLevel: number; // 0 - 100
  contrastRatio: number; // 0.0 - 1.0
  isObstructed: boolean;
  obstructionReason?: string;
  qualityRating: VisionQualityRating;
  sceneShiftDetected: boolean;
  disclaimer: string;
}

export type AudioClassification =
  | 'silence'
  | 'ambient_noise'
  | 'fan_noise'
  | 'keyboard_typing'
  | 'speech_detected'
  | 'multiple_speakers'
  | 'impulse_noise'
  | 'flatline_disconnected';

export interface AudioSpectralResult {
  decibels: number; // 0 - 100
  speechRatio: number; // 0.0 - 1.0 (Concentration in 300Hz-3400Hz speech band)
  spectralCentroid: number; // Frequency centroid in Hz
  classification: AudioClassification;
  isAnomaly: boolean;
  anomalyReason?: string;
  isFlatline: boolean;
  disclaimer: string;
}

export type IntegritySeverity = 'informational' | 'low' | 'medium' | 'high';

export interface ScoreDeductionItem {
  category: 'focus' | 'hotkey' | 'visual' | 'audio' | 'network' | 'obstruction' | 'accommodation';
  pointsDeducted: number;
  severity: IntegritySeverity;
  count: number;
  rationale: string;
}

export interface CandidateAccommodations {
  timeMultiplier?: number; // e.g. 1.0 (default), 1.25, 1.5, 2.0
  allowScreenReader?: boolean; // NVDA, JAWS, Narrator
  allowMagnifier?: boolean; // Windows Magnifier
  allowSpeechToText?: boolean; // Assistive voice dictation / verbal reading
  allowSpeechInput?: boolean; // Assistive speech input synonym
  highContrastMode?: boolean; // WCAG AAA High contrast
  fontSizeScale?: 'normal' | 'large' | 'extra-large'; // 100%, 125%, 150%
  reducedMotion?: boolean; // Disable animations
  allowFrequentBreaks?: boolean; // Extended medical/rest breaks
}

export interface BehavioralIntegrityMetrics {
  focusLossCount: number;
  totalUnfocusedSeconds: number;
  blockedShortcutAttempts: number;
  networkDisconnectCount: number;
  highNoiseEventsCount: number;
  multiPersonEventsCount: number;
  cameraObstructionCount: number;
  normalEnvironmentalEventsCount: number; // Keyboard typing, fan hum, brief glances
  overallAttentionScore: number; // 0 - 100 (100 = perfect attention, < 60 = review recommended)
  highestSeverity: IntegritySeverity;
  proctorReviewRecommended: boolean;
  scoreDeductions: ScoreDeductionItem[];
  summaryRationale: string[];
  disclaimer: string;
  accommodationsApplied?: CandidateAccommodations;
}

export const ETHICAL_PROCTORING_DISCLAIMER =
  'Automated telemetry indicators are heuristic signals provided solely for proctor review, not proof of academic misconduct.';

// Previous frame cache for scene-shift detection
let lastLuminanceSample: Uint8Array | null = null;
let consecutiveFlatlineCount = 0;

/**
 * Analyzes video stream frame for human face presence, multiple occupants,
 * camera lens obstruction, lighting levels, and sudden scene transitions.
 */
export async function analyzeVideoFrame(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  simulationMode = false
): Promise<VisionAnalysisResult> {
  const width = 160;
  const height = 120;

  if (simulationMode || !video || !canvas) {
    return {
      faceCount: 1,
      faces: [{ x: 30, y: 20, width: 60, height: 80, confidence: 0.9 }],
      status: 'verified',
      method: 'synthetic-simulation',
      lightingLevel: 65,
      contrastRatio: 0.75,
      isObstructed: false,
      qualityRating: 'optimal',
      sceneShiftDetected: false,
      disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
    };
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx || video.readyState < 2) {
    return {
      faceCount: 0,
      faces: [],
      status: 'absent',
      method: 'none',
      lightingLevel: 50,
      contrastRatio: 0.5,
      isObstructed: false,
      qualityRating: 'low_contrast',
      sceneShiftDetected: false,
      disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
    };
  }

  ctx.drawImage(video, 0, 0, width, height);

  let frameData: ImageData;
  try {
    frameData = ctx.getImageData(0, 0, width, height);
  } catch (_) {
    return {
      faceCount: 1,
      faces: [],
      status: 'verified',
      method: 'none',
      lightingLevel: 50,
      contrastRatio: 0.5,
      isObstructed: false,
      qualityRating: 'optimal',
      sceneShiftDetected: false,
      disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
    };
  }

  const d = frameData.data;
  const pixelCount = width * height;

  // 1. Lighting, Contrast & Obstruction Analysis
  let totalLuminance = 0;
  let minLum = 255;
  let maxLum = 0;
  const lumSamples = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const r = d[i * 4];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    const yLum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    lumSamples[i] = yLum;
    totalLuminance += yLum;
    if (yLum < minLum) minLum = yLum;
    if (yLum > maxLum) maxLum = yLum;
  }

  const meanLuminance = totalLuminance / pixelCount;
  const lightingLevel = Math.min(100, Math.round((meanLuminance / 255) * 100));
  const contrastRatio = Math.round(((maxLum - minLum) / 255) * 100) / 100;

  // Compute variance for obstruction detection
  let varianceSum = 0;
  for (let i = 0; i < pixelCount; i += 4) {
    const diff = lumSamples[i] - meanLuminance;
    varianceSum += diff * diff;
  }
  const variance = Math.sqrt(varianceSum / (pixelCount / 4));

  let isObstructed = false;
  let obstructionReason: string | undefined;

  if (variance < 5.0 && meanLuminance < 15) {
    isObstructed = true;
    obstructionReason = 'Camera lens appears fully covered or blackout condition detected';
  } else if (variance < 6.0 && meanLuminance > 240) {
    isObstructed = true;
    obstructionReason = 'Extreme glare or white obstruction covers camera sensor';
  }

  // Quality rating
  let qualityRating: VisionQualityRating = 'optimal';
  if (isObstructed) {
    qualityRating = 'obstructed';
  } else if (lightingLevel < 20) {
    qualityRating = 'low_light';
  } else if (lightingLevel > 85 && contrastRatio < 0.3) {
    qualityRating = 'extreme_backlight';
  } else if (contrastRatio < 0.25) {
    qualityRating = 'low_contrast';
  }

  // Scene shift detection (sudden large change in average luminance distribution)
  let sceneShiftDetected = false;
  if (lastLuminanceSample && lastLuminanceSample.length === pixelCount) {
    let diffAccumulator = 0;
    const stride = 16;
    let sampledCount = 0;
    for (let i = 0; i < pixelCount; i += stride) {
      diffAccumulator += Math.abs(lumSamples[i] - lastLuminanceSample[i]);
      sampledCount++;
    }
    const avgShift = diffAccumulator / sampledCount;
    if (avgShift > 55.0) {
      sceneShiftDetected = true;
    }
  }
  lastLuminanceSample = lumSamples;

  // 2. Primary: Native Browser FaceDetector (W3C Shape Detection API)
  if (typeof window !== 'undefined' && (window as any).FaceDetector && !isObstructed) {
    try {
      const detector = new (window as any).FaceDetector({ maxDetectedFaces: 5, fastMode: true });
      const detected = await detector.detect(canvas);
      if (Array.isArray(detected)) {
        const faces: DetectedFace[] = detected.map((f: any) => ({
          x: Math.round(f.boundingBox.x),
          y: Math.round(f.boundingBox.y),
          width: Math.round(f.boundingBox.width),
          height: Math.round(f.boundingBox.height),
          confidence: 0.95,
        }));

        let status: 'absent' | 'verified' | 'multiple' | 'partial_visibility' = 'verified';
        if (faces.length === 0) status = 'absent';
        else if (faces.length > 1) status = 'multiple';

        return {
          faceCount: faces.length,
          faces,
          status,
          method: 'native-shape-detector',
          lightingLevel,
          contrastRatio,
          isObstructed,
          obstructionReason,
          qualityRating,
          sceneShiftDetected,
          disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
        };
      }
    } catch (_) {}
  }

  // 3. Fallback: YCbCr Skin Chrominance Clustering & Spatial Geometry
  if (isObstructed) {
    return {
      faceCount: 0,
      faces: [],
      status: 'absent',
      method: 'chrominance-aspect-clustering',
      lightingLevel,
      contrastRatio,
      isObstructed: true,
      obstructionReason,
      qualityRating: 'obstructed',
      sceneShiftDetected,
      disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
    };
  }

  const skinGridWidth = 32;
  const skinGridHeight = 24;
  const cellW = width / skinGridWidth;
  const cellH = height / skinGridHeight;
  const skinDensity = new Uint8Array(skinGridWidth * skinGridHeight);

  for (let y = 0; y < height; y++) {
    const gy = Math.floor(y / cellH);
    for (let x = 0; x < width; x++) {
      const gx = Math.floor(x / cellW);
      const idx = (y * width + x) * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];

      const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
      const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
      const yLum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Human skin chrominance cluster
      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && yLum >= 35) {
        skinDensity[gy * skinGridWidth + gx]++;
      }
    }
  }

  // Connected region clustering
  const visited = new Uint8Array(skinGridWidth * skinGridHeight);
  const clusters: Array<{ minX: number; maxX: number; minY: number; maxY: number; count: number }> = [];
  let totalSkinMass = 0;

  for (let gy = 0; gy < skinGridHeight; gy++) {
    for (let gx = 0; gx < skinGridWidth; gx++) {
      const gIdx = gy * skinGridWidth + gx;
      if (visited[gIdx] || skinDensity[gIdx] < 6) continue;

      const queue = [{ x: gx, y: gy }];
      visited[gIdx] = 1;
      let minX = gx,
        maxX = gx,
        minY = gy,
        maxY = gy,
        total = 0;

      while (queue.length > 0) {
        const cur = queue.pop()!;
        total += skinDensity[cur.y * skinGridWidth + cur.x];
        totalSkinMass += skinDensity[cur.y * skinGridWidth + cur.x];
        if (cur.x < minX) minX = cur.x;
        if (cur.x > maxX) maxX = cur.x;
        if (cur.y < minY) minY = cur.y;
        if (cur.y > maxY) maxY = cur.y;

        const neighbors = [
          { x: cur.x + 1, y: cur.y },
          { x: cur.x - 1, y: cur.y },
          { x: cur.x, y: cur.y + 1 },
          { x: cur.x, y: cur.y - 1 },
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < skinGridWidth && n.y >= 0 && n.y < skinGridHeight) {
            const nIdx = n.y * skinGridWidth + n.x;
            if (!visited[nIdx] && skinDensity[nIdx] >= 6) {
              visited[nIdx] = 1;
              queue.push(n);
            }
          }
        }
      }

      const clusterW = maxX - minX + 1;
      const clusterH = maxY - minY + 1;
      const aspectRatio = clusterH / (clusterW || 1);

      // Facial oval geometry filter: aspect ratio 0.8 - 2.6 and minimum area
      if (total >= 40 && clusterW >= 3 && clusterH >= 4 && aspectRatio >= 0.8 && aspectRatio <= 2.6) {
        clusters.push({ minX, maxX, minY, maxY, count: total });
      }
    }
  }

  const faces: DetectedFace[] = clusters.map((c) => ({
    x: Math.round(c.minX * cellW),
    y: Math.round(c.minY * cellH),
    width: Math.round((c.maxX - c.minX + 1) * cellW),
    height: Math.round((c.maxY - c.minY + 1) * cellH),
    confidence: Math.min(0.92, 0.6 + c.count / 300),
  }));

  let status: 'absent' | 'verified' | 'multiple' | 'partial_visibility' = 'verified';
  if (faces.length === 0) {
    if (totalSkinMass >= 20) {
      status = 'partial_visibility';
    } else {
      status = 'absent';
    }
  } else if (faces.length > 1) {
    status = 'multiple';
  }

  return {
    faceCount: faces.length,
    faces,
    status,
    method: 'chrominance-aspect-clustering',
    lightingLevel,
    contrastRatio,
    isObstructed: false,
    qualityRating,
    sceneShiftDetected,
    disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
  };
}

/**
 * Analyzes audio spectrum across frequency bands to classify speech vs background noise,
 * fan noise, keyboard typing, microphone flatline disconnection, and acoustic transient spikes.
 */
export function analyzeAudioSpectrum(
  freqData: Uint8Array,
  sampleRate = 48000
): AudioSpectralResult {
  const binCount = freqData.length;
  if (binCount === 0) {
    return {
      decibels: 0,
      speechRatio: 0,
      spectralCentroid: 0,
      classification: 'silence',
      isAnomaly: false,
      isFlatline: false,
      disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
    };
  }

  const binWidth = sampleRate / (binCount * 2);

  // Band boundaries
  const lowEndBin = Math.min(binCount - 1, Math.ceil(250 / binWidth)); // HVAC / fan hum (< 250 Hz)
  const speechStartBin = Math.max(0, Math.floor(300 / binWidth));
  const speechEndBin = Math.min(binCount - 1, Math.ceil(3400 / binWidth));
  const highStartBin = Math.min(binCount - 1, Math.floor(3500 / binWidth)); // High frequency typing (> 3500 Hz)

  let totalEnergy = 0;
  let lowEnergy = 0;
  let speechEnergy = 0;
  let highEnergy = 0;
  let weightedFreqSum = 0;
  let nonZeroBins = 0;

  for (let i = 0; i < binCount; i++) {
    const val = freqData[i];
    if (val > 0) nonZeroBins++;
    const energy = val * val;
    totalEnergy += energy;
    weightedFreqSum += (i * binWidth) * energy;

    if (i <= lowEndBin) {
      lowEnergy += energy;
    }
    if (i >= speechStartBin && i <= speechEndBin) {
      speechEnergy += energy;
    }
    if (i >= highStartBin) {
      highEnergy += energy;
    }
  }

  const avgVal = Math.sqrt(totalEnergy / binCount);
  const decibels = Math.min(100, Math.round((avgVal / 180) * 100));
  const speechRatio = totalEnergy > 0 ? speechEnergy / totalEnergy : 0;
  const lowRatio = totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
  const highRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;
  const spectralCentroid = totalEnergy > 0 ? Math.round(weightedFreqSum / totalEnergy) : 0;

  // Microphone flatline detection (hardware disconnected or input muted)
  let isFlatline = false;
  if (nonZeroBins === 0 || decibels < 2) {
    consecutiveFlatlineCount++;
    if (consecutiveFlatlineCount >= 5) {
      isFlatline = true;
    }
  } else {
    consecutiveFlatlineCount = 0;
  }

  let classification: AudioClassification = 'ambient_noise';
  let isAnomaly = false;
  let anomalyReason: string | undefined;

  if (isFlatline) {
    classification = 'flatline_disconnected';
    isAnomaly = true;
    anomalyReason = 'Microphone hardware stream flatlined or silenced';
  } else if (decibels < 12) {
    classification = 'silence';
  } else if (lowRatio >= 0.60 && decibels < 55) {
    // Continuous low frequency hum (AC / fan noise) -> Non-anomaly
    classification = 'fan_noise';
    isAnomaly = false;
  } else if (highRatio >= 0.45 && speechRatio < 0.28 && decibels >= 18 && decibels < 65) {
    // Fast high-frequency mechanical transients without vocal harmonics -> Non-anomaly
    classification = 'keyboard_typing';
    isAnomaly = false;
  } else if (decibels >= 20 && speechRatio >= 0.40 && spectralCentroid >= 300 && spectralCentroid <= 3400) {
    classification = 'speech_detected';
    isAnomaly = true;
    anomalyReason = 'Human vocal formant frequencies detected in speech band (300Hz-3400Hz)';
  } else if (decibels >= 42 && speechRatio >= 0.35) {
    classification = 'multiple_speakers';
    isAnomaly = true;
    anomalyReason = 'Multiple speech harmonics or secondary conversational voice detected';
  } else if (decibels >= 70 && speechRatio < 0.25) {
    classification = 'impulse_noise';
    isAnomaly = true;
    anomalyReason = 'High decibel acoustic transient spike detected';
  } else {
    classification = 'ambient_noise';
  }

  return {
    decibels,
    speechRatio: Math.round(speechRatio * 100) / 100,
    spectralCentroid,
    classification,
    isAnomaly,
    anomalyReason,
    isFlatline,
    disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
  };
}

/**
 * Evaluates holistic multi-modal session telemetry to produce an objective,
 * human-reviewable, transparent behavioral integrity scorecard.
 */
export function evaluateSessionIntegrity(metrics: {
  focusLossCount: number;
  totalUnfocusedSeconds: number;
  blockedShortcutAttempts: number;
  networkDisconnectCount: number;
  highNoiseEventsCount: number;
  multiPersonEventsCount: number;
  cameraObstructionCount: number;
  normalEnvironmentalEventsCount?: number;
  accommodations?: CandidateAccommodations;
}): BehavioralIntegrityMetrics {
  const {
    focusLossCount,
    totalUnfocusedSeconds,
    blockedShortcutAttempts,
    networkDisconnectCount,
    highNoiseEventsCount,
    multiPersonEventsCount,
    cameraObstructionCount,
    normalEnvironmentalEventsCount = 0,
    accommodations,
  } = metrics;

  let attentionScore = 100;
  const scoreDeductions: ScoreDeductionItem[] = [];
  const summaryRationale: string[] = [];

  // 1. Window Focus Switches (Proportional Penalty with Accessibility Accommodation Immunity)
  if (focusLossCount > 0) {
    if (accommodations?.allowScreenReader || accommodations?.allowMagnifier) {
      // Screen readers (NVDA/JAWS/Narrator) and magnifiers naturally cause focus shifts
      scoreDeductions.push({
        category: 'accommodation',
        pointsDeducted: 0,
        severity: 'informational',
        count: focusLossCount,
        rationale: `Focus events (${totalUnfocusedSeconds}s) attributed to approved assistive technology (screen reader / magnifier)`,
      });
      summaryRationale.push(`${focusLossCount} assistive focus events (accommodation approved, 0 penalty)`);
    } else if (focusLossCount <= 2 && totalUnfocusedSeconds <= 5) {
      // Minor glance or notification popup
      const pts = 2;
      attentionScore -= pts;
      scoreDeductions.push({
        category: 'focus',
        pointsDeducted: pts,
        severity: 'low',
        count: focusLossCount,
        rationale: `Minor brief focus switch (${totalUnfocusedSeconds}s total)`,
      });
      summaryRationale.push(`${focusLossCount} minor focus glance (${totalUnfocusedSeconds}s)`);
    } else {
      const pts = Math.min(25, focusLossCount * 3 + Math.floor(totalUnfocusedSeconds / 15));
      attentionScore -= pts;
      const severity: IntegritySeverity = focusLossCount >= 5 || totalUnfocusedSeconds >= 30 ? 'high' : 'medium';
      scoreDeductions.push({
        category: 'focus',
        pointsDeducted: pts,
        severity,
        count: focusLossCount,
        rationale: `${focusLossCount} window switches totaling ${totalUnfocusedSeconds}s outside examination`,
      });
      summaryRationale.push(`${focusLossCount} window switches (${totalUnfocusedSeconds}s outside window)`);
    }
  }

  // 2. Restricted Shortcut Attempts (Alt+Tab, WinKey) with Screen Reader Navigation Immunity
  if (blockedShortcutAttempts > 0) {
    if (accommodations?.allowScreenReader) {
      scoreDeductions.push({
        category: 'accommodation',
        pointsDeducted: 0,
        severity: 'informational',
        count: blockedShortcutAttempts,
        rationale: `${blockedShortcutAttempts} navigational shortcuts attributed to approved screen reader usage`,
      });
      summaryRationale.push(`${blockedShortcutAttempts} screen reader navigation inputs (accommodation approved, 0 penalty)`);
    } else {
      const pts = Math.min(20, blockedShortcutAttempts * 4);
      attentionScore -= pts;
      const severity: IntegritySeverity = blockedShortcutAttempts >= 3 ? 'high' : 'medium';
      scoreDeductions.push({
        category: 'hotkey',
        pointsDeducted: pts,
        severity,
        count: blockedShortcutAttempts,
        rationale: `${blockedShortcutAttempts} restricted system hotkey attempts (Alt+Tab/WinKey)`,
      });
      summaryRationale.push(`${blockedShortcutAttempts} restricted hotkey attempts`);
    }
  }

  // 3. Multi-Person Detections
  if (multiPersonEventsCount > 0) {
    const pts = Math.min(30, multiPersonEventsCount * 15);
    attentionScore -= pts;
    scoreDeductions.push({
      category: 'visual',
      pointsDeducted: pts,
      severity: 'high',
      count: multiPersonEventsCount,
      rationale: `${multiPersonEventsCount} multiple person visual detection flags`,
    });
    summaryRationale.push(`${multiPersonEventsCount} multiple person flags`);
  }

  // 4. Camera Obstruction
  if (cameraObstructionCount > 0) {
    const pts = Math.min(30, cameraObstructionCount * 20);
    attentionScore -= pts;
    scoreDeductions.push({
      category: 'obstruction',
      pointsDeducted: pts,
      severity: 'high',
      count: cameraObstructionCount,
      rationale: `${cameraObstructionCount} camera sensor obstruction or blackout flags`,
    });
    summaryRationale.push(`${cameraObstructionCount} camera obstruction flags`);
  }

  // 5. Speech-Band Acoustic Anomalies with Assistive Speech Immunity
  if (highNoiseEventsCount > 0) {
    if (accommodations?.allowSpeechToText || accommodations?.allowSpeechInput) {
      scoreDeductions.push({
        category: 'accommodation',
        pointsDeducted: 0,
        severity: 'informational',
        count: highNoiseEventsCount,
        rationale: `${highNoiseEventsCount} acoustic events attributed to approved verbal reading / speech-to-text accommodation`,
      });
      summaryRationale.push(`${highNoiseEventsCount} assistive speech events (accommodation approved, 0 penalty)`);
    } else {
      const pts = Math.min(15, highNoiseEventsCount * 3);
      attentionScore -= pts;
      const severity: IntegritySeverity = highNoiseEventsCount >= 3 ? 'medium' : 'low';
      scoreDeductions.push({
        category: 'audio',
        pointsDeducted: pts,
        severity,
        count: highNoiseEventsCount,
        rationale: `${highNoiseEventsCount} acoustic vocal formant detections`,
      });
      summaryRationale.push(`${highNoiseEventsCount} speech anomalies`);
    }
  }

  // 6. Network Disconnects (Technical Fault Tolerance)
  if (networkDisconnectCount > 2) {
    const excessDrops = networkDisconnectCount - 2;
    const pts = Math.min(10, excessDrops * 2);
    attentionScore -= pts;
    scoreDeductions.push({
      category: 'network',
      pointsDeducted: pts,
      severity: 'low',
      count: networkDisconnectCount,
      rationale: `${networkDisconnectCount} network drops (first 2 waived for network tolerance)`,
    });
    summaryRationale.push(`${networkDisconnectCount} network disconnections`);
  }

  attentionScore = Math.max(0, Math.min(100, attentionScore));

  let highestSeverity: IntegritySeverity = 'informational';
  let proctorReviewRecommended = false;

  for (const item of scoreDeductions) {
    if (item.severity === 'high') {
      highestSeverity = 'high';
      proctorReviewRecommended = true;
      break;
    }
  }

  if (highestSeverity !== 'high') {
    for (const item of scoreDeductions) {
      if (item.severity === 'medium') {
        highestSeverity = 'medium';
        proctorReviewRecommended = true;
        break;
      } else if (item.severity === 'low') {
        highestSeverity = 'low';
      }
    }
  }

  return {
    focusLossCount,
    totalUnfocusedSeconds,
    blockedShortcutAttempts,
    networkDisconnectCount,
    highNoiseEventsCount,
    multiPersonEventsCount,
    cameraObstructionCount,
    normalEnvironmentalEventsCount,
    overallAttentionScore: attentionScore,
    highestSeverity,
    proctorReviewRecommended,
    scoreDeductions,
    summaryRationale,
    disclaimer: ETHICAL_PROCTORING_DISCLAIMER,
    accommodationsApplied: accommodations,
  };
}
