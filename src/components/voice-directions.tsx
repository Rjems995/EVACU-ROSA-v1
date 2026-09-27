'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function VoiceDirections({
  instructions,
  language,
}: {
  instructions: string[];
  language: string;
}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const generation = useRef(0);
  const signature = JSON.stringify(instructions);
  const fil = language === 'fil';
  useEffect(() => {
    setSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, []);
  useEffect(() => {
    setSpeaking(false);
    setMessage('');
    return () => {
      generation.current++;
      if (utterance.current) {
        window.speechSynthesis?.cancel();
        utterance.current = null;
      }
    };
  }, [signature, language]);

  function stop() {
    generation.current++;
    window.speechSynthesis.cancel();
    utterance.current = null;
    setSpeaking(false);
  }
  function read() {
    stop();
    setMessage('');
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) =>
      fil ? /^(fil|tl)(-|$)/i.test(v.lang) : /^en(-|$)/i.test(v.lang),
    );
    if (fil && !voice)
      setMessage(
        'Walang Filipino voice sa device. Gagamitin ang default voice; maaaring iba ang pagbigkas.',
      );
    const run = generation.current;
    setSpeaking(true);
    const next = (index: number) => {
      if (run !== generation.current) return;
      if (index >= instructions.length) {
        utterance.current = null;
        setSpeaking(false);
        return;
      }
      const speech = new SpeechSynthesisUtterance(instructions[index]);
      speech.lang = fil ? 'fil-PH' : 'en-PH';
      if (voice) speech.voice = voice;
      speech.rate = 0.9;
      speech.onend = () => next(index + 1);
      speech.onerror = () => {
        if (run !== generation.current) return;
        utterance.current = null;
        setSpeaking(false);
        setMessage(
          fil
            ? 'Hindi mabasa ang gabay. Gamitin ang nakasulat na direksyon o subukan muli.'
            : 'Voice playback failed. Use the written directions or try again.',
        );
      };
      utterance.current = speech;
      window.speechSynthesis.speak(speech);
    };
    next(0);
  }
  return (
    <div className="voice-directions">
      <button
        className="secondary-button"
        disabled={!supported}
        aria-pressed={speaking}
        onClick={speaking ? stop : read}
      >
        {speaking ? (
          <VolumeX size={18} aria-hidden="true" />
        ) : (
          <Volume2 size={18} aria-hidden="true" />
        )}
        {speaking
          ? fil
            ? 'Itigil ang boses'
            : 'Stop voice'
          : fil
            ? 'Pakinggan ang direksyon'
            : 'Read directions aloud'}
      </button>
      <p role="status">
        {!supported
          ? fil
            ? 'Walang suporta sa boses ang browser na ito.'
            : 'Voice is unavailable in this browser.'
          : message ||
            (fil
              ? 'Binabasa ang buong ruta. Walang live na pagsubaybay sa lokasyon.'
              : 'Reads the route overview. No live position tracking.')}
      </p>
    </div>
  );
}
