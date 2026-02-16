'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download } from 'lucide-react';

export default function QRGeneratorContent() {
  const [qrImage, setQrImage] = useState<string>('');
  const [qrData, setQrData] = useState('');
  const [rollNo, setRollNo] = useState('23B21A4565');
  const [qrId, setQrId] = useState('QR-19c0c7bc09f-uz8n4css');
  const [copied, setCopied] = useState(false);

  const generateQR = async () => {
    const data = JSON.stringify({ qrId, rollNo });
    setQrData(data);
    
    try {
      const url = await QRCode.toDataURL(data, {
        width: 300,
        margin: 2,
        color: { dark: '#000', light: '#FFF' },
      });
      setQrImage(url);
    } catch (err) {
      alert('Error generating QR code');
    }
  };

  const downloadQR = () => {
    if (!qrImage) return;
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `qr-${rollNo}.png`;
    link.click();
  };

  const copyQRData = () => {
    navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">QR Code Generator</h1>
        <p className="text-white/60 mb-8">Generate QR codes for student attendance testing</p>

        <div className="glass-effect-strong rounded-2xl border border-white/15 p-8 space-y-6">
          {/* Input Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-semibold mb-2">Roll No</label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="23B21A4565"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">QR ID</label>
              <input
                type="text"
                value={qrId}
                onChange={(e) => setQrId(e.target.value)}
                placeholder="QR-19c0c7bc09f-uz8n4css"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateQR}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 rounded-lg transition"
          >
            Generate QR Code
          </button>

          {/* QR Code Display */}
          {qrImage && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg flex justify-center">
                <img src={qrImage} alt="QR Code" className="w-64 h-64" />
              </div>

              {/* QR Data */}
              <div>
                <label className="block text-white font-semibold mb-2">QR Data (JSON)</label>
                <div className="bg-black/40 rounded-lg p-4 flex items-center gap-2">
                  <code className="text-cyan-300 text-sm flex-1 break-all">{qrData}</code>
                  <button
                    onClick={copyQRData}
                    className="p-2 hover:bg-white/10 rounded transition text-cyan-300"
                    title="Copy QR data"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-green-400 text-sm mt-2">✓ Copied!</p>}
              </div>

              {/* Download Button */}
              <button
                onClick={downloadQR}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download QR Image
              </button>

              {/* Instructions */}
              <div className="bg-blue-950/30 border border-blue-500/30 rounded-lg p-4 space-y-2">
                <p className="text-white font-semibold">📱 How to Test:</p>
                <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside">
                  <li>Download or screenshot the QR code above</li>
                  <li>Open the mobile app and go to Attendance page</li>
                  <li>Scan this QR code with your phone camera</li>
                  <li>The app will validate against QR ID: <code className="text-cyan-300">{qrId}</code></li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
