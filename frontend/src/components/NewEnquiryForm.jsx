import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icons';
import {
  COURSES,
  BATCHES,
  SOURCES,
  OPEN_STATUSES,
  COUNSELORS,
  isoDay,
  translateText
} from '../utils/helpers';

export default function NewEnquiryForm({
  counselorList = COUNSELORS,
  onSubmit,
  onCancel
}) {
  const [formData, setFormData] = useState({
    date: isoDay(new Date()),
    name: '',
    phone: '',
    city: '',
    course: '',
    batch: '',
    source: '',
    assignedTo: '',
    status: 'New',
    followUpDate: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-IN');
  const [voiceState, setVoiceState] = useState('');
  const recognitionRef = useRef(null);

  // Translation state
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState(null);
  const [translationError, setTranslationError] = useState('');

  const nameInputRef = useRef(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Voice speech-to-text setup
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState('Voice input requires Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = voiceLang;
      rec.interimResults = true;
      rec.continuous = true;

      const baseText = formData.notes && !/\s$/.test(formData.notes) ? formData.notes + " " : formData.notes;
      let finalText = '';

      rec.onstart = () => {
        setIsListening(true);
        setVoiceState('Listening… Speak now');
      };

      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const tr = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += tr.trim() + " ";
          else interim += tr;
        }
        setFormData(prev => ({ ...prev, notes: baseText + finalText + interim }));
      };

      rec.onerror = (ev) => {
        const errorMessages = {
          'not-allowed': 'Microphone access blocked. Please allow mic permissions.',
          'service-not-allowed': 'Microphone access blocked.',
          'no-speech': 'No speech detected. Try again.',
          'audio-capture': 'No microphone found.',
          'network': 'Voice network service unreachable.'
        };
        setVoiceState(errorMessages[ev.error] || 'Voice input stopped.');
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setVoiceState('');
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setVoiceState('Could not start microphone.');
      setIsListening(false);
    }
  };

  // Translation handler
  const handleTranslate = async () => {
    if (!formData.notes || !formData.notes.trim()) {
      setTranslationError('Please enter or dictate remarks first.');
      return;
    }

    setTranslating(true);
    setTranslationError('');
    setTranslation(null);

    try {
      const result = await translateText(formData.notes, 'en');
      setTranslation(result);
    } catch (err) {
      setTranslationError(err.message || 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleInsertTranslation = () => {
    if (!translation) return;
    setFormData(prev => ({
      ...prev,
      notes: (prev.notes ? prev.notes.trim() + '\n\n' : '') + `Translation (EN): ${translation}`
    }));
    setTranslation(null);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = "Enter the student's name.";
    }
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      errs.phone = "Enter exactly 10 digits for the mobile number.";
    }
    if (!formData.course) {
      errs.course = "Choose a course.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        course: formData.course,
        batch: formData.batch,
        source: formData.source,
        assignedTo: formData.assignedTo,
        status: formData.status || 'New',
        followUpDate: formData.followUpDate || '',
        notes: formData.notes.trim()
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      date: isoDay(new Date()),
      name: '',
      phone: '',
      city: '',
      course: '',
      batch: '',
      source: '',
      assignedTo: '',
      status: 'New',
      followUpDate: '',
      notes: ''
    });
    setErrors({});
    setTranslation(null);
    setTranslationError('');
    setVoiceState('');
  };

  return (
    <section>
      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-body">
          <h3>Add New Lead</h3>
          <div className="fgrid new-lead-grid">
            {/* Inquiry Date (Auto locked) */}
            <div className="fld">
              <label htmlFor="f-date">Inquiry Date</label>
              <div className="locked-field">
                <input
                  className="input"
                  id="f-date"
                  type="date"
                  value={formData.date}
                  disabled
                />
                <span className="ic lock" title="Set automatically to today">
                  <Icon name="lock" size={15} />
                </span>
              </div>
            </div>

            {/* Student Name */}
            <div className={`fld ${errors.name ? 'bad' : ''}`}>
              <label htmlFor="f-name">Student Name <em>*</em></label>
              <input
                ref={nameInputRef}
                className="input"
                id="f-name"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                autoComplete="off"
              />
              {errors.name && <div className="err">{errors.name}</div>}
            </div>

            {/* Contact Number */}
            <div className={`fld ${errors.phone ? 'bad' : ''}`}>
              <label htmlFor="f-phone">Contact Number <em>*</em></label>
              <input
                className="input"
                id="f-phone"
                name="phone"
                placeholder="10 Digit Mobile Number"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                autoComplete="off"
              />
              {errors.phone && <div className="err">{errors.phone}</div>}
            </div>

            {/* Locality/Area */}
            <div className="fld">
              <label htmlFor="f-city">Locality/Area</label>
              <input
                className="input"
                id="f-city"
                name="city"
                placeholder="Locality"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                autoComplete="off"
              />
            </div>

            {/* Course */}
            <div className={`fld ${errors.course ? 'bad' : ''}`}>
              <label htmlFor="f-course">Course <em>*</em></label>
              <select
                className="select"
                id="f-course"
                name="course"
                value={formData.course}
                onChange={(e) => {
                  setFormData({ ...formData, course: e.target.value });
                  if (errors.course) setErrors({ ...errors, course: '' });
                }}
              >
                <option value="">Select Course</option>
                {COURSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.course && <div className="err">{errors.course}</div>}
            </div>

            {/* Preferred Batch */}
            <div className="fld">
              <label htmlFor="f-batch">Preferred Batch Time</label>
              <select
                className="select"
                id="f-batch"
                name="batch"
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
              >
                <option value="">Select Batch</option>
                {BATCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Lead Source */}
            <div className="fld">
              <label htmlFor="f-source">Lead Source</label>
              <select
                className="select"
                id="f-source"
                name="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="">Select Source</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Counselor Assignment */}
            <div className="fld">
              <label htmlFor="f-assigned">Counselor</label>
              <select
                className="select"
                id="f-assigned"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              >
                <option value="">Select Counselor</option>
                {counselorList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Lead Status */}
            <div className="fld">
              <label htmlFor="f-status">Lead Status</label>
              <select
                className="select"
                id="f-status"
                name="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {OPEN_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Next Follow-up Date */}
            <div className="fld">
              <label htmlFor="f-follow">Next Follow-up Date</label>
              <input
                className="input"
                id="f-follow"
                name="followUpDate"
                type="date"
                value={formData.followUpDate}
                onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              />
            </div>

            {/* Remarks / Dictation & Translation */}
            <div className="fld full">
              <label htmlFor="f-notes">Remarks</label>
              <div className="notes-wrap">
                <textarea
                  className="textarea"
                  id="f-notes"
                  name="notes"
                  placeholder="Any additional notes or details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
                <button
                  className={`mic-inline ${isListening ? 'on' : ''}`}
                  type="button"
                  aria-label="Dictate remarks"
                  aria-pressed={isListening}
                  onClick={startVoice}
                  title="Speak notes into microphone"
                >
                  <span className="ic"><Icon name="mic" size={17} /></span>
                </button>
              </div>

              <div className="notes-tools">
                <label className="sr-only" htmlFor="fVoiceLang">Voice language</label>
                <select
                  className="select sm"
                  id="fVoiceLang"
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">हिन्दी (Hindi)</option>
                  <option value="en-US">English (US)</option>
                </select>

                <span className="voice-state">{voiceState}</span>

                <button
                  className="btn link sm"
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating}
                >
                  <span className="ic"><Icon name="translate" size={15} /></span>
                  {translating ? 'Translating…' : 'Translate'}
                </button>
              </div>

              {/* Translation Preview Box */}
              {translation && (
                <div className="translate-box">
                  <div className="tr-label">Translation (English)</div>
                  <p>{translation}</p>
                  <div className="tr-actions">
                    <button
                      className="btn sm"
                      type="button"
                      onClick={handleInsertTranslation}
                    >
                      Insert below original
                    </button>
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => setTranslation(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {translationError && (
                <div className="translate-box">
                  <div className="tr-error">{translationError}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={handleClear}>
            Clear form
          </button>
          <button
            className="btn primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save Lead'}
          </button>
        </div>
      </form>
    </section>
  );
}
