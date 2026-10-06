'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import NavLink from '@/components/NavLink';
import { toast } from 'react-hot-toast';
import {
  BeakerIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useActiveDevice } from '@/contexts/ActiveDeviceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getMasterLocalRelayNames } from '@/lib/nutrition-plan';
import { supabase } from '@/lib/supabase';
import { createRealtimeChannel } from '@/lib/realtime/channel';
import { DeviceMasterSelect } from '@/components/DeviceMasterSelect';
import { PhCalibrationSection } from '@/components/PhCalibrationSection';
import { EcPumpCalibrationSection } from '@/components/EcPumpCalibrationSection';
import { PumpQuantitySection } from '@/components/PumpQuantitySection';
import { useEcConfig } from '@/hooks/useEcConfig';
import { usePhConfig } from '@/hooks/usePhConfig';

export default function CalibragemPage() {
  const { t } = useLanguage();
  const { deviceId: selectedDeviceId, selected: selectedDevice } = useActiveDevice();
  const activeDeviceRef = useRef(selectedDeviceId);
  activeDeviceRef.current = selectedDeviceId;
  const [relayOptions, setRelayOptions] = useState<Array<{ number: number; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'vazao' | 'ganhos' | 'quantidade'>('vazao');
  const [procedureOpen, setProcedureOpen] = useState(false);

  const ecConfig = useEcConfig(selectedDeviceId, Boolean(selectedDeviceId));
  const phConfig = usePhConfig(selectedDeviceId, Boolean(selectedDeviceId));
  const configLoading = ecConfig.isLoading || phConfig.isLoading;
  const autoBlocked = Boolean(ecConfig.auto_enabled || phConfig.auto_enabled);
  const isOnline = Boolean(selectedDevice?.is_online);

  useEffect(() => {
    setRelayOptions([]);
  }, [selectedDeviceId]);

  const loadRelayNames = useCallback(async () => {
    const requestedId = selectedDeviceId;
    if (!requestedId) return;
    try {
      const names = await getMasterLocalRelayNames(requestedId);
      if (activeDeviceRef.current !== requestedId) return;
      const relays: Array<{ number: number; name: string }> = [];
      for (let i = 0; i <= 7; i++) {
        relays.push({ number: i, name: names.get(i) || `Relé ${i}` });
      }
      setRelayOptions((prev) => {
        if (
          prev.length === relays.length &&
          prev.every((row, i) => row.number === relays[i].number && row.name === relays[i].name)
        ) {
          return prev;
        }
        return relays;
      });
    } catch (e) {
      console.error(e);
      toast.error(t.calibragem.toastLoadRelays);
    }
  }, [selectedDeviceId, t.calibragem.toastLoadRelays]);

  useEffect(() => {
    if (selectedDeviceId) void loadRelayNames();
  }, [selectedDeviceId, loadRelayNames]);

  useEffect(() => {
    const id = selectedDeviceId?.trim();
    if (!id) return;
    const channel = createRealtimeChannel(`hidrowave-calib-relay-names-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'relay_master', filter: `device_id=eq.${id}` },
        () => {
          void loadRelayNames();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedDeviceId, loadRelayNames]);

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent flex items-center gap-2">
                <BeakerIcon className="w-7 h-7 text-aqua-400" />
                {t.pages.calibragemTitle}
              </h1>
              <p className="text-dark-textSecondary mt-1 text-sm">
                {t.pages.calibragemSubtitle}
              </p>
            </div>
            <DeviceMasterSelect />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        <div className="flex gap-2 border-b border-dark-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('vazao')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'vazao'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 border-b-transparent -mb-px'
                : 'text-dark-textSecondary hover:text-cyan-400/80'
            }`}
          >
            {t.pages.calibragemTabFlow}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ganhos')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'ganhos'
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/40 border-b-transparent -mb-px'
                : 'text-dark-textSecondary hover:text-violet-400/80'
            }`}
          >
            {t.pages.calibragemTabGains}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quantidade')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'quantidade'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 border-b-transparent -mb-px'
                : 'text-dark-textSecondary hover:text-emerald-400/80'
            }`}
          >
            {t.pages.calibragemTabQty}
          </button>
        </div>

        {activeTab === 'ganhos' ? (
          selectedDeviceId ? (
            <PhCalibrationSection
              key={selectedDeviceId}
              deviceId={selectedDeviceId}
              relayOptions={relayOptions}
              isOnline={isOnline}
              autoBlocked={autoBlocked}
              commandsLocked={configLoading}
            />
          ) : (
            <p className="text-dark-textSecondary text-sm">{t.calibragem.selectDevice}</p>
          )
        ) : activeTab === 'quantidade' ? (
          selectedDeviceId ? (
            <PumpQuantitySection
              key={selectedDeviceId}
              deviceId={selectedDeviceId}
              relayOptions={relayOptions}
            />
          ) : (
            <p className="text-dark-textSecondary text-sm">{t.calibragem.selectDevice}</p>
          )
        ) : (
          <>
            <section className="bg-gradient-to-br from-cyan-500/10 to-sky-500/5 border border-cyan-500/30 rounded-xl p-5">
              <div className="flex gap-3">
                <InformationCircleIcon className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-dark-textSecondary space-y-2">
                  <p>{t.calibragem.assignedOnly}</p>
                </div>
              </div>
            </section>

            <section className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setProcedureOpen((v) => !v)}
                aria-expanded={procedureOpen}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dark-surface/50 transition-colors"
              >
                <span>
                  <span className="block text-lg font-semibold text-dark-text">
                    {t.calibragem.procedureTitle}
                  </span>
                  {!procedureOpen ? (
                    <span className="block text-xs text-dark-textSecondary mt-0.5">
                      {t.calibragem.procedureHint}
                    </span>
                  ) : null}
                </span>
                {procedureOpen ? (
                  <ChevronUpIcon className="w-5 h-5 text-dark-textSecondary shrink-0" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary shrink-0" />
                )}
              </button>
              {procedureOpen ? (
                <ol className="space-y-3 px-4 pb-4 border-t border-dark-border pt-4">
                  {t.calibragem.steps.map((step, i) => (
                    <li
                      key={step.title}
                      className="flex gap-4 bg-dark-surface border border-dark-border rounded-lg p-4"
                    >
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </span>
                      <div>
                        <h3 className="font-medium text-dark-text">{step.title}</h3>
                        <p className="text-sm text-dark-textSecondary mt-1">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            {selectedDeviceId ? (
              <EcPumpCalibrationSection
                key={selectedDeviceId}
                deviceId={selectedDeviceId}
                isOnline={isOnline}
                autoBlocked={autoBlocked}
                commandsLocked={configLoading}
                relayOptions={relayOptions}
              />
            ) : (
              <p className="text-dark-textSecondary text-sm">{t.calibragem.selectDevice}</p>
            )}

            <section className="text-sm text-dark-textSecondary border border-dark-border rounded-xl p-5">
              <h2 className="font-semibold text-dark-text mb-2">{t.calibragem.whenTitle}</h2>
              <ul className="list-disc list-inside space-y-1">
                {t.calibragem.whenItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">
                <NavLink href="/automacao" className="text-aqua-400 hover:underline">
                  {t.calibragem.backAutomacao}
                </NavLink>
                {' · '}
                {t.calibragem.footerHint}
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
