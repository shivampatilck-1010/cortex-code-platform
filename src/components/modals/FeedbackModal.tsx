'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  Lightbulb,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  FileCode,
  Terminal,
  Database,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { FeedbackDiagnostics } from '@/lib/feedback/feedback-service';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics?: FeedbackDiagnostics;
  defaultType?: 'bug' | 'error' | 'feature' | 'general';
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  defaultType = 'bug',
}) => {
  const [type, setType] = useState<'bug' | 'error' | 'feature' | 'general'>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showDiagnosticsPreview, setShowDiagnosticsPreview] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<{ id: string; emailSent?: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setType(diagnostics?.stderr ? 'bug' : defaultType);
      setSubmittedRecord(null);
      setErrorMessage(null);
    }
  }, [isOpen, defaultType, diagnostics?.stderr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Please provide a short description or details.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        type,
        title: title.trim() || `${type.toUpperCase()} Report`,
        description: description.trim(),
        email: email.trim() || undefined,
        severity,
        diagnostics: includeDiagnostics ? diagnostics : undefined,
      };

      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmittedRecord({
        id: data.id,
        emailSent: data.record?.emailDelivery?.sent,
      });
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-text">
      <div className="bg-[#141518] border border-[#262832] rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden text-xs max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#18191e] border-b border-[#22242c] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <CortexLogo variant="icon" size="sm" />
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Feedback & Bug Detection
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-[#ff9100]/10 text-[#ff9100] border border-[#ff9100]/20">
                  Database & Mail Sync
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Help us improve Cortex. Reports are stored in database and routed to our team.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-md hover:bg-[#252834] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {submittedRecord ? (
            /* Success View */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Report Successfully Submitted!</h4>
                <p className="text-gray-400 text-xs max-w-md mx-auto">
                  Thank you! Your submission has been saved to the database and queued for developer review.
                </p>
              </div>

              <div className="bg-[#18191f] border border-[#252832] rounded-lg p-3 max-w-md mx-auto text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Tracking Reference:</span>
                  <span className="font-mono text-[#ff9100] font-semibold">{submittedRecord.id}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-400" /> Database Status:
                  </span>
                  <span className="text-emerald-400 font-medium">Saved (data/feedback.json)</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" /> Email Dispatch:
                  </span>
                  <span className={submittedRecord.emailSent ? 'text-emerald-400 font-medium' : 'text-gray-400 font-medium'}>
                    {submittedRecord.emailSent ? 'Sent to Support Team' : 'Preserved for Support'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => setSubmittedRecord(null)}
                  className="px-4 py-2 bg-[#20222a] hover:bg-[#282a36] text-gray-300 rounded-md transition font-medium text-xs"
                >
                  Send Another Report
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#ff9100] hover:bg-[#e08000] text-black font-semibold rounded-md transition text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Category Tabs */}
              <div>
                <label className="text-gray-300 text-[11px] font-semibold block mb-1.5">
                  Submission Category:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'bug', label: 'Bug / Error', icon: Bug, color: 'text-red-400' },
                    { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-400' },
                    { id: 'general', label: 'General Feedback', icon: MessageSquare, color: 'text-blue-400' },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = type === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setType(tab.id as any)}
                        className={`flex items-center justify-center space-x-2 py-2 px-2.5 rounded-lg border text-xs font-medium transition ${
                          isSelected
                            ? 'bg-[#22242e] border-[#ff9100] text-white shadow-sm'
                            : 'bg-[#18191f] border-[#252832] text-gray-400 hover:text-gray-200 hover:border-[#333742]'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-detected Error Box (if error exists) */}
              {diagnostics?.stderr && (
                <div className="bg-[#1e191b] border border-red-500/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-red-400 font-semibold text-xs">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>Active Error Detected</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticsPreview((p) => !p)}
                      className="text-gray-400 hover:text-gray-200 flex items-center space-x-1 text-[11px]"
                    >
                      <span>{showDiagnosticsPreview ? 'Hide Details' : 'View Error Logs'}</span>
                      {showDiagnosticsPreview ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Language: <strong className="text-gray-200">{diagnostics.language || 'N/A'}</strong>
                    </span>
                    <span>
                      File: <strong className="text-gray-200">{diagnostics.activeFile || 'N/A'}</strong>
                    </span>
                    <span>
                      Exit Code: <strong className="text-red-400">{diagnostics.exitCode ?? 1}</strong>
                    </span>
                  </div>

                  {showDiagnosticsPreview && (
                    <div className="mt-2 p-2 bg-[#0c0d10] rounded border border-[#2b2529] font-mono text-[11px] text-red-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {diagnostics.stderr}
                    </div>
                  )}

                  <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDiagnostics}
                      onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                      className="rounded border-[#3a3c48] bg-[#121316] text-[#ff9100] focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-gray-300 text-[11px]">
                      Include error logs & code context automatically with report
                    </span>
                  </label>
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="text-gray-300 text-[11px] font-semibold block mb-1">
                  Title / Summary:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'e.g. GCC linker error with multi-file headers'
                      : type === 'feature'
                      ? 'e.g. Add support for Vim keybindings'
                      : 'e.g. Auto-fix suggestions are super helpful'
                  }
                  className="w-full px-3 py-2 bg-[#18191f] border border-[#252832] focus:border-[#ff9100] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition"
                />
              </div>

              {/* Description Textarea */}
              <div>
                <label className="text-gray-300 text-[11px] font-semibold block mb-1">
                  Description / What Happened: <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'Explain what went wrong or how to reproduce this issue...'
                      : 'Share your thoughts, suggestions, or how we can improve...'
                  }
                  className="w-full px-3 py-2 bg-[#18191f] border border-[#252832] focus:border-[#ff9100] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition resize-none leading-relaxed"
                />
              </div>

              {/* Severity & User Email Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Severity Dropdown */}
                <div>
                  <label className="text-gray-300 text-[11px] font-semibold block mb-1">
                    Severity / Priority:
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#18191f] border border-[#252832] focus:border-[#ff9100] rounded-lg text-xs text-white outline-none transition"
                  >
                    <option value="low">Low (Minor tweak / cosmetic)</option>
                    <option value="medium">Medium (Normal issue / request)</option>
                    <option value="high">High (Broken feature)</option>
                    <option value="critical">Critical (Blocking work)</option>
                  </select>
                </div>

                {/* Email Input */}
                <div>
                  <label className="text-gray-300 text-[11px] font-semibold block mb-1">
                    Your Email (Optional):
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com (for follow-up)"
                    className="w-full px-3 py-2 bg-[#18191f] border border-[#252832] focus:border-[#ff9100] rounded-lg text-xs text-white placeholder-gray-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Error Notice */}
              {errorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-[#22242c]">
                <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#ff9100]" /> Saved to database & dispatched to mail
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 text-xs text-gray-400 hover:text-white rounded-md transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-black font-semibold text-xs rounded-md transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
