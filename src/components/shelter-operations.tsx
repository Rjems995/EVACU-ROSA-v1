'use client';
import type { Shelter } from '@/lib/types';
import { useLanguage } from './language-provider';
export default function ShelterOperations({ shelter: s }: { shelter: Shelter }) {
  const { t, language } = useLanguage();
  const updated = s.updated_at ? new Date(s.updated_at) : null;
  const valid = updated && Number.isFinite(updated.getTime());
  const stale = valid && Date.now() - updated.getTime() > 86400000;
  return (
    <div className="shelter-operations">
      <p>{t(s.entrance_verified ? 'Entrance checked by staff' : 'Entrance not yet verified')}</p>
      <dl>
        {(
          [
            ['Drinking water', s.water_status],
            ['Food', s.food_status],
            ['First aid', s.medical_status],
          ] as const
        ).map(([label, status]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{t(status || 'unknown')}</dd>
          </div>
        ))}
      </dl>
      {s.operational_notes && <p>{s.operational_notes}</p>}
      <p>
        {t('Last shelter update')}:{' '}
        {valid ? (
          <time dateTime={s.updated_at}>
            {updated.toLocaleString(language === 'fil' ? 'fil-PH' : 'en-PH')}
          </time>
        ) : (
          t('No update time reported')
        )}
      </p>
      {stale && (
        <p className="inline-warning">
          {t('Shelter information is over 24 hours old. Confirm with staff.')}
        </p>
      )}
    </div>
  );
}
