import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileText, Camera, Edit3, CheckCircle, AlertCircle, QrCode, Upload, Printer, Download } from 'lucide-react';
import SignaturePadModal from './SignaturePadModal';
import qrImage from './QR-TRADER-INVOICE-FORM.jpeg';

// Helper to convert base64 dataUrl to File object for upload
function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export default function TraderInvoiceForm({ onSuccess, onCancel, isPublic = false, initialData }) {
  const [formData, setFormData] = useState({
    id: '',
    traderNameOrArea: '',
    shopName: '',
    invoiceDate: '',
    invoiceNumber: '',
    tpDate: '',
    tpNumber: '',
    salesmanName: '',
    invoiceSubmittedDate: new Date().toISOString().split('T')[0],
    billAmount: '',
    deliveredAt: 'via whatsapp', // default option
    handedOverTo: '',
  });

  const [signatureDataUrl, setSignatureDataUrl] = useState(null);

  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [traders, setTraders] = useState([]);
  const [isSigPadOpen, setIsSigPadOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch Shops, Users, and Vendors (Traders)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [shopsRes, usersRes, vendorsRes] = await Promise.all([
          supabase.from('shop').select('shop_name').order('shop_name', { ascending: true }),
          supabase.from('users').select('user_name, shop_name').order('user_name', { ascending: true }),
          supabase.from('purchase_vendors').select('party_name').order('party_name', { ascending: true })
        ]);

        if (shopsRes.error) throw shopsRes.error;
        if (usersRes.error) throw usersRes.error;

        setShops((shopsRes.data || []).map(s => s.shop_name).filter(Boolean));
        setUsers(usersRes.data || []);
        setTraders((vendorsRes.data || []).map(v => v.party_name).filter(Boolean));
      } catch (err) {
        console.error('Error fetching form meta:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Set form data from initialData if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id || '',
        traderNameOrArea: initialData.trader_name_or_area || '',
        shopName: initialData.shop_name || '',
        invoiceDate: initialData.invoice_date || '',
        invoiceNumber: initialData.invoice_number || '',
        tpDate: initialData.tp_date || '',
        tpNumber: initialData.tp_number || '',
        salesmanName: initialData.salesman_name || '',
        invoiceSubmittedDate: initialData.invoice_submitted_date || '',
        billAmount: initialData.bill_amount?.toString() || '',
        deliveredAt: initialData.delivered_at || 'via whatsapp',
        handedOverTo: initialData.handed_over_to || '',
      });
      if (initialData.photo) {
        setPhotoPreview(initialData.photo);
      }
      if (initialData.digital_signature) {
        setSignatureDataUrl(initialData.digital_signature);
      }
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (!formData.shopName) throw new Error('Please select a Shop Name.');
      if (!signatureDataUrl) throw new Error('Please provide a digital signature.');

      const timestampStr = Date.now();
      const bucketName = 'business_overview_trader_invoices';

      // Upload Digital Signature to business_overview_trader_invoices/Digital_signatures/
      let sigUrlToSave = signatureDataUrl;
      if (signatureDataUrl && signatureDataUrl.startsWith('data:image')) {
        const signatureFile = dataURLtoFile(signatureDataUrl, `signature_${timestampStr}.png`);
        const signaturePath = `Digital_signatures/signature_${timestampStr}.png`;
        const { error: sigUploadErr } = await supabase.storage
          .from(bucketName)
          .upload(signaturePath, signatureFile);

        if (sigUploadErr) {
          throw new Error(`Failed to upload signature: ${sigUploadErr.message}`);
        }

        const { data: { publicUrl: sigPublicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(signaturePath);

        sigUrlToSave = sigPublicUrl;
      }

      const payload = {
        trader_name_or_area: formData.traderNameOrArea || null,
        invoice_date: formData.invoiceDate || null,
        tp_date: formData.tpDate || null,
        salesman_name: formData.salesmanName || null,
        invoice_submitted_date: formData.invoiceSubmittedDate || null,
        shop_name: formData.shopName || null,
        invoice_number: formData.invoiceNumber || null,
        tp_number: formData.tpNumber || null,
        delivered_at: formData.deliveredAt || null,
        receiver_sign: null,
        photo: initialData?.photo || null,
        bill_amount: parseFloat(formData.billAmount) || 0,
        handed_over_to: formData.handedOverTo || null,
        digital_signature: sigUrlToSave
      };

      if (formData.id) {
        // Update existing row
        const { error: dbUpdateErr } = await supabase
          .from('bis_overview_trader_invoices')
          .update(payload)
          .eq('id', formData.id);

        if (dbUpdateErr) throw dbUpdateErr;
        setSuccessMsg('Invoice updated successfully!');
      } else {
        // Insert new row
        const { error: dbInsertErr } = await supabase
          .from('bis_overview_trader_invoices')
          .insert(payload);

        if (dbInsertErr) throw dbInsertErr;
        setSuccessMsg('Invoice submitted successfully!');
      }

      // Clear Form state if NOT editing
      if (!formData.id) {
        setFormData({
          traderNameOrArea: '',
          shopName: '',
          invoiceDate: '',
          invoiceNumber: '',
          tpDate: '',
          tpNumber: '',
          salesmanName: '',
          invoiceSubmittedDate: new Date().toISOString().split('T')[0],
          billAmount: '',
          deliveredAt: 'via whatsapp',
          handedOverTo: '',
        });
        setSignatureDataUrl(null);
      }

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1200);
      }
    } catch (err) {
      console.error('[TraderInvoiceForm] Submission error:', err);
      setErrorMsg(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const imgUrl = new URL(qrImage, window.location.href).href;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - Trader Invoice Form</title>
          <style>
            @media print {
              @page { size: auto; margin: 15mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body {
              margin: 0;
              padding: 40px 20px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 80vh;
              background-color: #ffffff;
              color: #0f172a;
            }
            .qr-container {
              border: 2px solid #e2e8f0;
              border-radius: 20px;
              padding: 32px 24px;
              text-align: center;
              max-width: 320px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            }
            .qr-img {
              width: 220px;
              height: 220px;
              object-fit: contain;
              margin: 0 auto 16px auto;
              display: block;
            }
            .title {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 6px 0;
              color: #1e293b;
            }
            .subtitle {
              font-size: 12px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${imgUrl}" alt="Trader Invoice Form QR Code" class="qr-img" />
            <h2 class="title">Trader Invoice Form</h2>
            <p class="subtitle">Scan QR code to open form on mobile</p>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'trader-invoice-form-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading QR image:', err);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl w-full max-w-2xl mx-auto space-y-5 font-sans">

      {/* Space for QR Code Image at the top */}
      {!isPublic && (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs">
          <img src={qrImage} alt="QR Code" className="w-28 h-28 object-contain mb-1.5" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Scan QR Code to Open Form on Mobile</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintQR}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a5298] hover:bg-[#1e3c72] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer size={13} />
              <span>Print QR</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadQR}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Invoice Information */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-100 flex items-center gap-1.5">
            <FileText size={14} className="text-[#2a5298]" />
            Invoice Details
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Trader Name / Area <span className="text-red-500">*</span>
              </label>
              <select
                name="traderNameOrArea"
                value={formData.traderNameOrArea}
                onChange={handleChange}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              >
                <option value="">Select Trader / Party Name</option>
                {traders.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Shop Name <span className="text-red-500">*</span>
              </label>
              <select
                name="shopName"
                value={formData.shopName}
                onChange={handleChange}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              >
                <option value="">Select Shop</option>
                {shops.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                placeholder="Enter Invoice No."
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleChange}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                TP Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="tpNumber"
                value={formData.tpNumber}
                onChange={handleChange}
                placeholder="Enter TP No."
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                TP Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="tpDate"
                value={formData.tpDate}
                onChange={handleChange}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Salesman Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="salesmanName"
                value={formData.salesmanName}
                onChange={handleChange}
                placeholder="Enter Salesman Name"
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Invoice Submitted Date <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="invoiceSubmittedDate"
                value={formData.invoiceSubmittedDate}
                readOnly
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-100 font-semibold text-gray-600 cursor-not-allowed select-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Bill Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="billAmount"
                value={formData.billAmount}
                onChange={handleChange}
                placeholder="0.00"
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Delivered At <span className="text-red-500">*</span>
              </label>
              <select
                name="deliveredAt"
                value={formData.deliveredAt}
                onChange={handleChange}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              >
                <option value="via whatsapp">via WhatsApp</option>
                <option value="office">Office</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Handed Over To <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="handedOverTo"
                value={formData.handedOverTo}
                onChange={handleChange}
                placeholder="Enter person name"
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
            </div>
          </div>
        </div>

        {/* Signature Field */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-100 flex items-center gap-1.5">
            <Edit3 size={14} className="text-[#2a5298]" />
            Digital Signature Verification
          </h4>

          {/* Signature field */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              Digital Signature <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100/50 transition-colors relative cursor-pointer min-h-[140px] group"
              onClick={() => setIsSigPadOpen(true)}>
              {signatureDataUrl ? (
                <div className="w-full h-28 relative rounded-lg overflow-hidden bg-white p-1 border border-gray-200 flex items-center justify-center">
                  <img src={signatureDataUrl} alt="Signature preview" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="text-center py-4">
                  <Edit3 className="mx-auto text-gray-400 group-hover:text-gray-600 transition-colors mb-1.5" size={24} />
                  <span className="text-xs text-gray-600 font-semibold">Sign Here</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">Click to draw digital signature</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messaging feedback */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-3">
          {!isPublic && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-[#2a5298] text-white hover:bg-[#1e3d70] rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? 'Submitting...' : 'Submit Invoice'}
          </button>
        </div>
      </form>

      {/* Signature pad modal overlay */}
      <SignaturePadModal
        isOpen={isSigPadOpen}
        onClose={() => setIsSigPadOpen(false)}
        onSave={setSignatureDataUrl}
      />
    </div>
  );
}
