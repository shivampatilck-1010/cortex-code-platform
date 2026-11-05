'use client';

import React, { useState } from 'react';
import { X, Award, Shield, Clock, AlertCircle, Save, Check } from 'lucide-react';
import { Exam, ExamSecurityLevel, ExamStatus } from '@/lib/classroom/models';

interface ExamBuilderModalProps {
  classroomId: string;
  existingExam: Exam | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ExamBuilderModal({ classroomId, existingExam, onClose, onSaved }: ExamBuilderModalProps) {
  const isEditing = !!existingExam;

  const [title, setTitle] = useState(existingExam?.title || '');
  const [description, setDescription] = useState(existingExam?.description || '');
  const [durationMinutes, setDurationMinutes] = useState(existingExam?.durationMinutes || 60);

  // Default to today and tomorrow
  const toLocalIso = (ts: number) => {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [startTimeStr, setStartTimeStr] = useState(
    existingExam?.startTime ? toLocalIso(existingExam.startTime) : toLocalIso(Date.now())
  );
  const [endTimeStr, setEndTimeStr] = useState(
    existingExam?.endTime ? toLocalIso(existingExam.endTime) : toLocalIso(Date.now() + 86400000 * 2)
  );

  const [totalMarks, setTotalMarks] = useState(existingExam?.totalMarks || 100);
  const [passingMarks, setPassingMarks] = useState(existingExam?.passingMarks || 40);
  const [attemptsAllowed, setAttemptsAllowed] = useState(existingExam?.attemptsAllowed || 1);
  const [securityLevel, setSecurityLevel] = useState<ExamSecurityLevel>(existingExam?.securityLevel || 'standard');
  const [sebQuitPassword, setSebQuitPassword] = useState(existingExam?.sebQuitPassword || '');
  const [sebAllowReload, setSebAllowReload] = useState(existingExam?.sebAllowReload || false);
  const [sebShowReloadWarning, setSebShowReloadWarning] = useState(existingExam?.sebShowReloadWarning !== false);
  const [status, setStatus] = useState<ExamStatus>(existingExam?.status || 'draft');
  const [shuffleQuestions, setShuffleQuestions] = useState(existingExam?.shuffleQuestions || false);
  const [shuffleOptions, setShuffleOptions] = useState(existingExam?.shuffleOptions || false);
  const [showResultsImmediately, setShowResultsImmediately] = useState(existingExam?.showResultsImmediately || false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const startTs = new Date(startTimeStr).getTime();
    const endTs = new Date(endTimeStr).getTime();

    if (isNaN(startTs) || isNaN(endTs)) {
      setError('Please provide valid start and end dates');
      return;
    }

    if (endTs <= startTs) {
      setError('End date and time must be after the start date and time');
      return;
    }

    if (passingMarks > totalMarks) {
      setError('Passing marks cannot exceed total marks');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        durationMinutes: parseInt(String(durationMinutes), 10),
        startTime: startTs,
        endTime: endTs,
        totalMarks: parseFloat(String(totalMarks)),
        passingMarks: parseFloat(String(passingMarks)),
        attemptsAllowed: parseInt(String(attemptsAllowed), 10),
        securityLevel,
        sebQuitPassword: sebQuitPassword.trim() || undefined,
        sebAllowReload,
        sebShowReloadWarning,
        status,
        shuffleQuestions,
        shuffleOptions,
        showResultsImmediately,
      };

      const url = isEditing
        ? `/api/v1/classrooms/${classroomId}/exams/${existingExam.id}`
        : `/api/v1/classrooms/${classroomId}/exams`;

      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save examination');
      }

      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Error saving examination');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1013] border border-[#262830] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22242b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {isEditing ? 'Edit Examination Configuration' : 'Create New Examination'}
              </h2>
              <p className="text-xs text-gray-400">Configure parameters, schedules, marks, and security constraints.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Examination Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Examination: Data Structures and Algorithms"
              className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF9100]/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Instructions / Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter guidelines, allowed calculators or notes, and rules for students..."
              className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF9100]/60 resize-none"
            />
          </div>

          {/* Timing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min={5}
                max={600}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Start Window</label>
              <input
                type="datetime-local"
                required
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">End Window</label>
              <input
                type="datetime-local"
                required
                value={endTimeStr}
                onChange={(e) => setEndTimeStr(e.target.value)}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              />
            </div>
          </div>

          {/* Marks and Attempts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Total Marks</label>
              <input
                type="number"
                min={1}
                required
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Passing Marks</label>
              <input
                type="number"
                min={0}
                required
                value={passingMarks}
                onChange={(e) => setPassingMarks(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Attempts Allowed</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={attemptsAllowed}
                onChange={(e) => setAttemptsAllowed(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              />
            </div>
          </div>

          {/* Security and Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Security Level</label>
              <select
                value={securityLevel}
                onChange={(e) => setSecurityLevel(e.target.value as ExamSecurityLevel)}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              >
                <option value="standard">Level 1: Standard Browser Examination (Deadline & Tab Focus Monitoring)</option>
                <option value="restricted">Level 2: Cortex Lockdown Required (Windows Desktop Kiosk, App Switching & Screen Capture Blocked)</option>
                <option value="seb">Level 3: Institution-Managed Restricted Examination (Safe Exam Browser)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Examination Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExamStatus)}
                className="w-full px-3 py-2 bg-[#141519] border border-[#252730] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
              >
                <option value="draft">Draft (Hidden from students)</option>
                <option value="scheduled">Scheduled (Visible, opens on start window)</option>
                <option value="published">Published (Ready for testing/taking)</option>
                <option value="active">Active (Currently underway)</option>
                {isEditing && <option value="ended">Ended (Submissions closed)</option>}
                {isEditing && <option value="results_published">Results Published (Grades released)</option>}
              </select>
            </div>
          </div>

          {/* Cortex Lockdown Desktop Enforcement Card */}
          {securityLevel === 'restricted' && (
            <div className="p-3.5 bg-cyan-950/20 border border-cyan-800/40 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#FF9100]" />
                  Cortex Lockdown Desktop Enforcement (Windows 10/11 x64)
                </span>
                <a
                  href="/lockdown"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-2 py-0.5 bg-cyan-900/40 hover:bg-cyan-900/70 text-cyan-200 border border-cyan-700/50 rounded font-semibold transition"
                >
                  Download Page
                </a>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                When enabled, students cannot take this examination in a standard browser. Candidates must install the native Cortex Lockdown application (v1.0.0-rc1.2), pass mandatory system readiness checks (single display, Windows 10/11 x64, kiosk lockdown), and receive an authorized launch grant before the test opens.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-gray-400">
                <div className="bg-[#0e1014] p-2 rounded border border-[#1f222b]">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono tracking-wider">Required Client</span>
                  <span className="text-white font-medium">v1.0.0-rc1.2 (Setup EXE)</span>
                </div>
                <div className="bg-[#0e1014] p-2 rounded border border-[#1f222b]">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono tracking-wider">Environment Lock</span>
                  <span className="text-cyan-300 font-medium">Full Kiosk &amp; Shortcut Suppression</span>
                </div>
                <div className="bg-[#0e1014] p-2 rounded border border-[#1f222b]">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono tracking-wider">Launch Grant</span>
                  <span className="text-[#FF9100] font-medium">HMAC-SHA256 (120s TTL)</span>
                </div>
              </div>
            </div>
          )}

          {/* Safe Exam Browser Configuration Box */}
          {securityLevel === 'seb' && (
            <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Safe Exam Browser (SEB) Settings
                </span>
                {isEditing && existingExam && (
                  <a
                    href={`/api/v1/classrooms/${classroomId}/exams/${existingExam.id}/seb-config`}
                    download
                    className="text-[11px] px-2.5 py-1 bg-rose-900/50 hover:bg-rose-900 text-rose-200 rounded font-semibold transition"
                  >
                    Download .seb File
                  </a>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Safe Exam Browser transforms client computers into a secure workstation. Students must open the generated .seb configuration file to take this exam.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">Quit Password (Optional)</label>
                  <input
                    type="password"
                    value={sebQuitPassword}
                    onChange={(e) => setSebQuitPassword(e.target.value)}
                    placeholder={existingExam?.hasQuitPassword ? 'Password set (leave blank to keep unchanged)' : 'Enter password to exit SEB early'}
                    className="w-full px-2.5 py-1.5 bg-[#141519] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-rose-500/60"
                  />
                </div>
                <div className="space-y-1.5 pt-4">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sebAllowReload}
                      onChange={(e) => setSebAllowReload(e.target.checked)}
                      className="rounded border-[#30333d] bg-[#1a1b22] text-rose-500 focus:ring-0"
                    />
                    <span>Allow page reload in SEB</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sebShowReloadWarning}
                      onChange={(e) => setSebShowReloadWarning(e.target.checked)}
                      className="rounded border-[#30333d] bg-[#1a1b22] text-rose-500 focus:ring-0"
                    />
                    <span>Show warning before reload</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Options & Randomization Toggles */}
          <div className="space-y-2 border-t border-[#1e2026] pt-3">
            <span className="block text-xs font-semibold text-gray-300">Assessment Policies</span>

            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded border-[#30333d] bg-[#1a1b22] text-[#FF9100] focus:ring-0"
              />
              <span>Shuffle question order for each student</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="rounded border-[#30333d] bg-[#1a1b22] text-[#FF9100] focus:ring-0"
              />
              <span>Shuffle option order in multiple-choice questions</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showResultsImmediately}
                onChange={(e) => setShowResultsImmediately(e.target.checked)}
                className="rounded border-[#30333d] bg-[#1a1b22] text-[#FF9100] focus:ring-0"
              />
              <span>Show score and results immediately upon submission (otherwise wait for manual release)</span>
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#22242b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-300 hover:text-white text-xs font-medium border border-[#2a2d36] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-[#FF9100]/10 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Examination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
