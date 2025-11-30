import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalLogProps {
  logs: LogEntry[];
}

const TerminalLog: React.FC<TerminalLogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {logs.map((log) => (
        <div
          key={log.id}
          className={`flex ${
            log.sender === 'USER' ? 'justify-end' : 'justify-start'
          }`}
        >
          {log.sender === 'SYSTEM' ? (
            <div className="w-full text-center text-xs text-gray-500 my-2">
              {log.text}
            </div>
          ) : (
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                log.sender === 'USER'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-800 text-gray-100 rounded-bl-none'
              }`}
            >
              {log.text}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default TerminalLog;