'use client';
import { useLanguage } from './language-provider';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Position } from '@/lib/types';

export default function AssistanceRequest({
  origin,
  source,
  noRoute,
  enabled,
}: {
  origin: Position;
  source: 'gps' | 'selected';
  noRoute: boolean;
  enabled: boolean;
}) {
  const { t, language } = useLanguage();
  const [automatic, setAutomatic] = useState(false);
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const attempt = useRef<Record<string, unknown> | null>(null);
  const sending = useRef(false),
    autoAttempted = useRef(false),
    delivered = useRef(false);
  const send = useCallback(async () => {
    if (sending.current || delivered.current || !enabled) return;
    if (!navigator.onLine) {
      setStatus('failed');
      setMessage(
        'You are offline. The request has not been sent. Connect and retry, or contact local responders directly.',
      );
      return;
    }
    sending.current = true;
    setStatus('sending');
    setMessage('');
    attempt.current ??= {
      id: crypto.randomUUID(),
      origin,
      source,
      details,
      contact,
      consent: true,
    };
    try {
      const response = await fetch('/api/assistance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.current),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || data.received !== true || data.id !== attempt.current.id)
        throw new Error(data.error || 'Delivery could not be confirmed.');
      delivered.current = true;
      setStatus('sent');
      setMessage(
        'Request received by the CDRRMO system. This does not confirm that a responder has seen it or that help has been dispatched.',
      );
    } catch {
      setStatus('failed');
      setMessage('Delivery could not be confirmed. Please retry.');
    } finally {
      sending.current = false;
    }
  }, [origin, source, details, contact, enabled]);
  useEffect(() => {
    if (automatic && noRoute && enabled && !autoAttempted.current) {
      autoAttempted.current = true;
      void send();
    }
  }, [automatic, noRoute, enabled, send]);
  return (
    <section className="assistance-request" aria-label="CDRRMO assistance request">
      <label className="accessibility-filter">
        <input
          type="checkbox"
          checked={automatic}
          disabled={!enabled || status === 'sending' || status === 'sent'}
          onChange={(event) => setAutomatic(event.target.checked)}
        />
        {t('Automatically notify CDRRMO with this location if no suitable route is found')}{' '}
      </label>
      <p className="text-sm">
        {language === 'fil'
          ? 'Kapag pinayagan mo, sa CDRRMO lamang ipapadala ang lokasyon mo. Maaaring walang ruta dahil sa saradong kalsada, walang bakanteng masisilungan o kulang na datos.'
          : `Shares your ${source === 'gps' ? 'detected' : 'selected'} location only with CDRRMO when enabled. A missing route may reflect blocked roads, shelter availability, or incomplete map data.`}
      </p>
      {(noRoute || status !== 'idle') && (
        <>
          <h3 className="mt-3 font-bold">{t('No suitable route? Request assistance')} </h3>
          <p>
            {language === 'fil'
              ? 'Tiyaking dito mo kailangan ng tulong:'
              : 'Check that this is where you need help:'}{' '}
            {origin[1].toFixed(6)}, {origin[0].toFixed(6)}.{' '}
            {language === 'fil'
              ? 'Baguhin ang lokasyon kung kailangan.'
              : 'Change your starting point if needed.'}
          </p>
          <label className="field">
            {t('Contact number or name (optional)')}{' '}
            <input
              value={contact}
              maxLength={120}
              disabled={status !== 'idle'}
              onChange={(event) => setContact(event.target.value)}
            />
          </label>
          <label className="field">
            {t('Situation or nearby landmark (optional)')}{' '}
            <textarea
              value={details}
              maxLength={500}
              disabled={status !== 'idle'}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!enabled || status === 'sending' || status === 'sent'}
            onClick={() => void send()}
          >
            {status === 'sending'
              ? t('Sending request…')
              : status === 'sent'
                ? t('Request received')
                : status === 'failed'
                  ? t('Retry assistance request')
                  : t('Share location and notify CDRRMO')}
          </button>
          {!enabled && <p>{t('Reporting is not available until CDRRMO setup is complete.')} </p>}
          {message && (
            <p className="my-2" role="status">
              {t(message)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
