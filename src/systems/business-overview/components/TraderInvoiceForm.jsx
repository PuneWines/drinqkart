import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileText, Camera, Edit3, CheckCircle, AlertCircle, QrCode, Upload } from 'lucide-react';
import SignaturePadModal from './SignaturePadModal';
import qrImage from './QR-TRADER-INVOICE-FORM.png';

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
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [formData, setFormData] = useState({
    id: '',
    traderNameOrArea: '',
    shopName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    tpDate: new Date().toISOString().split('T')[0],
    tpNumber: '',
    salesmanName: '',
    invoiceSubmittedDate: new Date().toISOString().split('T')[0],
    billAmount: '',
    deliveredAt: 'via whatsapp', // default option
    handedOverTo: '',
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);

  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [isSigPadOpen, setIsSigPadOpen] = useState(false);
  const [isPhotoSourceModalOpen, setIsPhotoSourceModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch Shops and Users
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [shopsRes, usersRes] = await Promise.all([
          supabase.from('shop').select('shop_name').order('shop_name', { ascending: true }),
          supabase.from('users').select('user_name, shop_name').order('user_name', { ascending: true })
        ]);

        if (shopsRes.error) throw shopsRes.error;
        if (usersRes.error) throw usersRes.error;

        setShops((shopsRes.data || []).map(s => s.shop_name).filter(Boolean));
        setUsers(usersRes.data || []);
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

  // Filter users based on selected shop name
  const filteredUsers = useMemo(() => {
    if (!formData.shopName) return [];
    const targetShop = formData.shopName.trim().toLowerCase();
    return users.filter(u => {
      const uShops = (u.shop_name || '')
        .split(',')
        .map(s => s.trim().toLowerCase());
      return uShops.includes(targetShop);
    });
  }, [formData.shopName, users]);

  // Set default handedOverTo when matching users list changes
  useEffect(() => {
    if (filteredUsers.length > 0) {
      // If the currently selected user is not in the filtered list, reset it
      if (!filteredUsers.some(u => u.user_name === formData.handedOverTo)) {
        setFormData(prev => ({ ...prev, handedOverTo: filteredUsers[0].user_name }));
      }
    } else {
      setFormData(prev => ({ ...prev, handedOverTo: '' }));
    }
  }, [filteredUsers]);

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
      
      if (!formData.id) {
        if (!photoFile) throw new Error('Please upload a photo of the invoice.');
        if (!signatureDataUrl) throw new Error('Please provide a digital signature.');
      } else {
        if (!photoPreview) throw new Error('Please upload a photo of the invoice.');
        if (!signatureDataUrl) throw new Error('Please provide a digital signature.');
      }

      const timestampStr = Date.now();
      const bucketName = 'business_overview_trader_invoices';

      // 1. Upload Photo to business_overview_trader_invoices/Photos/
      let photoUrlToSave = photoPreview;
      if (photoFile) {
        const photoExtension = photoFile.name.split('.').pop() || 'jpg';
        const photoPath = `Photos/photo_${timestampStr}_${Math.floor(Math.random() * 1000)}.${photoExtension}`;
        const { error: photoUploadErr } = await supabase.storage
          .from(bucketName)
          .upload(photoPath, photoFile);
        
        if (photoUploadErr) {
          throw new Error(`Failed to upload photo: ${photoUploadErr.message}. Make sure the bucket "${bucketName}" exists and is public.`);
        }

        const { data: { publicUrl: photoPublicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(photoPath);

        photoUrlToSave = photoPublicUrl;
      }

      // 2. Upload Digital Signature to business_overview_trader_invoices/Digital_signatures/
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
        photo: photoUrlToSave,
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
          invoiceDate: new Date().toISOString().split('T')[0],
          invoiceNumber: '',
          tpDate: new Date().toISOString().split('T')[0],
          tpNumber: '',
          salesmanName: '',
          invoiceSubmittedDate: new Date().toISOString().split('T')[0],
          billAmount: '',
          deliveredAt: 'via whatsapp',
          handedOverTo: '',
        });
        setPhotoFile(null);
        setPhotoPreview(null);
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

  return (
    <div className="bg-white p-5 rounded-2xl w-full max-w-2xl mx-auto space-y-5 font-sans">
      
      {/* Space for QR Code Image at the top */}
      {!isPublic && (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs">
          <img src={qrImage} alt="QR Code" className="w-28 h-28 object-contain mb-1.5" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scan QR Code to Open Form on Mobile</span>
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
              <input
                type="text"
                name="traderNameOrArea"
                value={formData.traderNameOrArea}
                onChange={handleChange}
                placeholder="Enter name or area"
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
              />
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
                type="date"
                name="invoiceSubmittedDate"
                value={formData.invoiceSubmittedDate}
                onChange={handleChange}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
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

        {/* Media & Signature Fields */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-100 flex items-center gap-1.5">
            <Camera size={14} className="text-[#2a5298]" />
            Verification & Verification File Proofs
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Photo upload field */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Upload Photo <span className="text-red-500">*</span>
              </label>
              
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <div
                onClick={() => setIsPhotoSourceModalOpen(true)}
                className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition-colors relative cursor-pointer min-h-[160px] group"
              >
                {photoPreview ? (
                  <div className="w-full h-32 relative rounded-lg overflow-hidden flex items-center justify-center">
                    <img src={photoPreview} alt="Invoice preview" className="w-full h-full object-contain" />
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-md backdrop-blur-xs font-medium">Click to change</span>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Camera className="mx-auto text-gray-400 group-hover:text-gray-600 transition-colors mb-1.5" size={24} />
                    <span className="text-xs text-gray-700 font-semibold">Click to Select Photo</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">Upload from device or open camera</p>
                  </div>
                )}
              </div>
            </div>

            {/* Signature field */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Digital Signature <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100/50 transition-colors relative cursor-pointer min-h-[160px] group"
                   onClick={() => setIsSigPadOpen(true)}>
                {signatureDataUrl ? (
                  <div className="w-full h-24 relative rounded-lg overflow-hidden bg-white p-1 border border-gray-200">
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

      {/* Photo Source Choice Modal */}
      {isPhotoSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                <Camera size={16} className="text-[#2a5298]" />
                Select Photo Source
              </h3>
              <button
                type="button"
                onClick={() => setIsPhotoSourceModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xs p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: Upload from Device */}
              <button
                type="button"
                onClick={() => {
                  setIsPhotoSourceModalOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#2a5298] hover:bg-blue-50/50 transition-all text-left group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#2a5298] flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-[#2a5298] group-hover:text-white transition-colors">
                  <Upload size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800">Upload from Device</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Select image from gallery or files</p>
                </div>
              </button>

              {/* Option 2: Open Camera */}
              <button
                type="button"
                onClick={() => {
                  setIsPhotoSourceModalOpen(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#2a5298] hover:bg-blue-50/50 transition-all text-left group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Camera size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800">Open Camera</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Take photo directly using camera</p>
                </div>
              </button>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setIsPhotoSourceModalOpen(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature pad modal overlay */}
      <SignaturePadModal
        isOpen={isSigPadOpen}
        onClose={() => setIsSigPadOpen(false)}
        onSave={setSignatureDataUrl}
      />
    </div>
  );
}
