'use client';

import React, { useEffect, useState } from 'react';
import { toggleRelay } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HwBadge } from '@/components/ui/HwBadge';
import { HwButton } from '@/components/ui/HwButton';
import { HwInput } from '@/components/ui/HwInput';
import { HW_LABEL } from '@/lib/design-tokens';

type RelayControlProps = {
  title: string;
  relayNumber: number;
  active?: boolean;
  icon?: React.ReactNode;
  showTimer?: boolean;
};

export default function RelayControl({
  title,
  relayNumber,
  active = false,
  icon,
  showTimer = false,
}: RelayControlProps) {
  const [isActive, setIsActive] = useState(active);
  const [seconds, setSeconds] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsActive(active);
  }, [active]);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const success = await toggleRelay(relayNumber, seconds);
      if (success) {
        setIsActive(!isActive);
        toast.success(`${title} ${isActive ? 'desativado' : 'ativado'} por ${seconds} segundos`);

        if (!isActive) {
          setTimeout(() => {
            setIsActive(false);
          }, seconds * 1000);
        }
      } else {
        toast.error(`Erro ao controlar ${title}`);
      }
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <InstrumentCard
      accent={isActive ? 'warn' : 'brand'}
      title={
        <div className="flex items-center justify-between gap-2">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            <HwBadge accent={isActive ? 'ok' : 'neutral'}>
              {isActive ? 'Ativo' : 'Inativo'}
            </HwBadge>
            {icon && <div className="text-aqua-400">{icon}</div>}
          </div>
        </div>
      }
    >
      {showTimer && (
        <div className="mb-3">
          <HwInput
            id={`timer-${relayNumber}`}
            label="Tempo (segundos)"
            type="number"
            min={1}
            max={3600}
            value={seconds}
            onChange={(e) => setSeconds(parseInt(e.target.value, 10) || 1)}
          />
        </div>
      )}

      <HwButton
        variant={isActive ? 'danger' : 'primary'}
        fullWidth
        onClick={handleToggle}
        disabled={isLoading}
        aria-label={isActive ? `Desativar ${title}` : `Ativar ${title}`}
      >
        {isLoading ? 'Processando...' : isActive ? 'Desativar' : 'Ativar'}
      </HwButton>
      <p className={`mt-2 ${HW_LABEL}`}>Relé #{relayNumber}</p>
    </InstrumentCard>
  );
}
