'use client';

import SyllabusContent from './syllabus-content';
import Script from 'next/script';

export default function SyllabusPage() {
  return (
    <>
      <Script 
        src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js" 
        type="module"
        strategy="beforeInteractive"
      />
      <SyllabusContent />
    </>
  );
}
