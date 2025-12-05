-- Adiciona índice único parcial para prevenir agendamentos duplicados no mesmo horário
-- Apenas agendamentos que não foram cancelados são considerados
CREATE UNIQUE INDEX appointments_professional_date_time_active_unique 
ON appointments (professional_id, date, time) 
WHERE status != 'cancelled';