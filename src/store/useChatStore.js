import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const DEFAULT_BROADCAST_TEXT = ''

const formatWhatsAppNumber = (rawPhone) => {
  if (!rawPhone) return { cleanPhone: '', cid: '' }
  let str = String(rawPhone).split('@')[0]
  let digits = str.replace(/[^0-9]/g, '')
  if (!digits) return { cleanPhone: '', cid: '' }
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = '91' + digits
  }
  return {
    cleanPhone: digits,
    cid: `${digits}@c.us`,
  }
}

const INITIAL_ATTACHMENTS = []

const INITIAL_BROADCAST_HISTORY = [
  {
    id: 'bc-101',
    title: 'Daily Sales Report',
    date: 'Yesterday',
    sentCount: 210,
    status: 'Delivered',
    shopName: 'All Shops',
    files: ['SalesReport.pdf'],
  },
  {
    id: 'bc-102',
    title: 'Salary Notification',
    date: '2 Days Ago',
    sentCount: 188,
    status: 'Delivered',
    shopName: 'KUNAL ULWE',
    files: [],
  },
  {
    id: 'bc-103',
    title: 'Festival Offer Banner',
    date: 'Last Week',
    sentCount: 420,
    status: 'Completed',
    shopName: 'All Shops',
    files: ['Poster.jpg'],
  },
]

export const useChatStore = create((set, get) => ({
  shops: [],
  stores: [],
  selectedShopIds: [],
  selectedStoreIds: [],
  selectedEmployeeIds: [],
  roleFilter: 'all',
  shopSearchQuery: '',
  storeSearchQuery: '',
  composerText: DEFAULT_BROADCAST_TEXT,
  attachments: INITIAL_ATTACHMENTS,
  broadcastHistory: INITIAL_BROADCAST_HISTORY,
  scheduledCampaign: null,
  templates: [],
  messageStats: { sent: 0, delivered: 0, read: 0 },

  // Dashboard view toggle ('broadcast' | 'whatsapp')
  activeDashboardTab: 'broadcast',
  whatsappConversations: [],
  selectedConversationId: null,
  whatsappMessages: [],
  isNewContactModalOpen: false,
  whatsappSearchQuery: '',

  // Modals
  templatesModalOpen: false,
  scheduleModalOpen: false,
  historyModalOpen: false,
  createTemplateModalOpen: false,

  // Schedule Actions
  setScheduledCampaign: ({ date, time }) => set({ scheduledCampaign: { date, time } }),
  clearScheduledCampaign: () => set({ scheduledCampaign: null }),

  fetchTemplates: async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      const mapped = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        content: t.message, // Map message to content for UI compatibility
        category: 'General'
      }));
      set({ templates: mapped });
    } catch (err) {
      console.error('Error fetching templates from Supabase:', err);
    }
  },

  saveNewTemplate: async ({ name, message }) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert([{ name, message }])
        .select();

      if (error) throw error;
      await get().fetchTemplates();
      return { success: true };
    } catch (err) {
      console.error('Error saving template to Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  deleteTemplate: async (id) => {
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchTemplates();
      return { success: true };
    } catch (err) {
      console.error('Error deleting template from Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  loadShopsAndEmployees: async () => {
    set({ loading: true });
    try {
      // 1. Fetch shops from Supabase
      const { data: shopsDb, error: shopsErr } = await supabase
        .from('shop')
        .select('id, shop_name')
        .order('shop_name', { ascending: true });

      if (shopsErr) throw shopsErr;

      // 2. Fetch active users (employees) with a valid phone number from Supabase
      const { data: usersDb, error: usersErr } = await supabase
        .from('users')
        .select('id, user_name, number, role, shop_name, status')
        .eq('status', 'active')
        .not('number', 'is', null)
        .order('user_name', { ascending: true });

      if (usersErr) throw usersErr;

      // 3. Group and map users to shops
      const mappedShops = (shopsDb || []).map((shop) => {
        const shopEmployees = (usersDb || [])
          .filter((u) => u.shop_name === shop.shop_name && u.number && String(u.number).trim() !== '')
          .map((u) => ({
            id: u.id.toString(), // Stringified for safe string-comparison in UI checkboxes
            name: u.user_name || 'Unnamed',
            role: u.role || 'Staff',
            phone: String(u.number).trim(),
            status: 'online',
          }));

        return {
          id: shop.id.toString(),
          name: shop.shop_name,
          address: '',
          totalEmployees: shopEmployees.length,
          employees: shopEmployees,
        };
      });

      // 4. Update store and pre-select the first shop + its employees
      const firstShop = mappedShops[0];
      set({
        shops: mappedShops,
        stores: mappedShops,
        selectedShopIds: firstShop ? [firstShop.id] : [],
        selectedStoreIds: firstShop ? [firstShop.id] : [],
        selectedEmployeeIds: firstShop ? firstShop.employees.map((e) => e.id) : [],
        loading: false,
      });
    } catch (err) {
      console.error('Error loading shops and employees from Supabase:', err);
      set({ loading: false });
    }
  },

  // Shop & Selection Actions
  setShopSearchQuery: (q) => set({ shopSearchQuery: q, storeSearchQuery: q }),
  setStoreSearchQuery: (q) => set({ shopSearchQuery: q, storeSearchQuery: q }),
  setRoleFilter: (f) => set({ roleFilter: f }),

  toggleShopSelection: (shopId) =>
    set((s) => {
      const isSelected = s.selectedShopIds.includes(shopId)
      const nextShopIds = isSelected
        ? s.selectedShopIds.filter((id) => id !== shopId)
        : [...s.selectedShopIds, shopId]

      const shop = s.shops.find((st) => st.id === shopId)
      const shopEmpIds = shop ? shop.employees.map((e) => e.id) : []

      const nextEmpIds = isSelected
        ? s.selectedEmployeeIds.filter((id) => !shopEmpIds.includes(id))
        : Array.from(new Set([...s.selectedEmployeeIds, ...shopEmpIds]))

      return {
        selectedShopIds: nextShopIds,
        selectedStoreIds: nextShopIds,
        selectedEmployeeIds: nextEmpIds,
      }
    }),

  toggleStoreSelection: (shopId) => get().toggleShopSelection(shopId),

  toggleEmployeeSelection: (empId) =>
    set((s) => ({
      selectedEmployeeIds: s.selectedEmployeeIds.includes(empId)
        ? s.selectedEmployeeIds.filter((id) => id !== empId)
        : [...s.selectedEmployeeIds, empId],
    })),

  toggleAllEmployees: (empIds) =>
    set((s) => {
      const allSelected = empIds.every((id) => s.selectedEmployeeIds.includes(id))
      const nextEmpIds = allSelected
        ? s.selectedEmployeeIds.filter((id) => !empIds.includes(id))
        : Array.from(new Set([...s.selectedEmployeeIds, ...empIds]))
      return { selectedEmployeeIds: nextEmpIds }
    }),

  // Composer & Attachment Actions
  setComposerText: (text) => set({ composerText: text }),

  insertVariable: (varName) =>
    set((s) => ({
      composerText: `${s.composerText} ${varName}`,
    })),

  removeAttachment: (id) =>
    set((s) => ({
      attachments: s.attachments.filter((a) => a.id !== id),
    })),

  addAttachment: async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('whatsapp_broadcast')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp_broadcast')
        .getPublicUrl(fileName);

      set((s) => ({
        attachments: [
          ...s.attachments,
          {
            id: `att-${Date.now()}`,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            icon: file.type?.startsWith('image/') ? '🖼️' : file.type?.includes('excel') || file.name.endsWith('.xlsx') ? '📊' : '📄',
            type: file.type || 'document',
            url: publicUrl,
          },
        ],
      }));
    } catch (err) {
      console.error('Error uploading file to Supabase storage:', err);
      alert('Failed to upload file to Supabase storage. Ensure the whatsapp_broadcast storage bucket exists.');
    }
  },

  // Modal Triggers
  openTemplatesModal: () => set({ templatesModalOpen: true }),
  closeTemplatesModal: () => set({ templatesModalOpen: false }),
  openScheduleModal: () => set({ scheduleModalOpen: true }),
  closeScheduleModal: () => set({ scheduleModalOpen: false }),
  openHistoryModal: () => set({ historyModalOpen: true }),
  closeHistoryModal: () => set({ historyModalOpen: false }),
  openCreateTemplateModal: () => set({ createTemplateModalOpen: true }),
  closeCreateTemplateModal: () => set({ createTemplateModalOpen: false }),

  fetchBroadcastHistory: async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_history')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      const mappedHistory = (data || []).map((item) => ({
        id: item.id,
        title: item.campaign_title,
        date: item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Just now',
        sentCount: item.sent_count,
        status: item.status,
        shopName: item.shop_target,
        files: item.files || [],
      }));

      set({ broadcastHistory: mappedHistory });
    } catch (err) {
      console.error('Error fetching history from Supabase:', err);
    }
  },

  fetchMessageStats: async () => {
    try {
      const { count: sentCount, error: err1 } = await supabase
        .from('whatsapp_message_logs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['sent', 'delivered', 'read']);

      const { count: delCount, error: err2 } = await supabase
        .from('whatsapp_message_logs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['delivered', 'read']);

      const { count: readCount, error: err3 } = await supabase
        .from('whatsapp_message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'read');

      if (err1 || err2 || err3) throw (err1 || err2 || err3);

      set({
        messageStats: {
          sent: sentCount || 0,
          delivered: delCount || 0,
          read: readCount || 0
        }
      });
    } catch (err) {
      console.error('Error fetching message stats:', err);
    }
  },

  // Broadcast Trigger
  sendDashboardBroadcast: async () => {
    const { composerText, selectedShopIds, selectedEmployeeIds, attachments, scheduledCampaign, shops, templates } = get()
    if (!composerText.trim() || selectedEmployeeIds.length === 0) return

    // 1. Resolve shop target text
    const targetShopNames = shops
      .filter((s) => selectedShopIds.includes(s.id))
      .map((s) => s.name);
    const shopTarget = targetShopNames.length === shops.length ? 'All Shops' : targetShopNames.join(', ');

    // 2. Identify if a template was used
    const matchedTemplate = templates.find((t) => t.message === composerText || t.content === composerText);
    const templateName = matchedTemplate ? matchedTemplate.name : null;

    try {
      // 3. Insert record into Supabase whatsapp_history table
      const { data: insertedCampaigns, error } = await supabase.from('whatsapp_history').insert([
        {
          campaign_title: composerText.split('\n')[0].substring(0, 30) || 'WhatsApp Campaign',
          shop_target: shopTarget,
          sent_count: selectedEmployeeIds.length,
          status: scheduledCampaign ? 'Scheduled' : 'Sent',
          files: attachments.map((a) => a.url),
          template: templateName,
          message: composerText,
        },
      ]).select();

      if (error) throw error;
      const campaignId = insertedCampaigns?.[0]?.id;

      // 4. Resolve selected employee details and send via Maytapi
      const PRODUCT_ID = import.meta.env.VITE_MAYTAPI_PRODUCT_ID;
      const PHONE_ID = import.meta.env.VITE_MAYTAPI_PHONE_ID;
      const TOKEN = import.meta.env.VITE_MAYTAPI_ACCESS_TOKEN;

      const allEmployees = shops.flatMap((s) => s.employees || []);
      const selectedEmployees = allEmployees.filter((emp) => selectedEmployeeIds.includes(emp.id));

      const logsToInsert = [];

      for (const emp of selectedEmployees) {
        const { cleanPhone, cid } = formatWhatsAppNumber(emp.phone);
        if (!cleanPhone || !cid) continue;

        const personalizedMessage = composerText.replace(/\{\{Employee Name\}\}/g, emp.name || '');
        let messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let status = 'failed';
        let errorMessage = null;
        let errorRawResponse = null;

        if (PRODUCT_ID && PHONE_ID && TOKEN) {
          try {
            const pid = String(PRODUCT_ID).trim();
            const phid = String(PHONE_ID).trim();
            const tok = String(TOKEN).trim();
            const url = `https://api.maytapi.com/api/${pid}/${phid}/sendMessage`;

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-maytapi-key': tok,
              },
              body: JSON.stringify({
                to_number: cleanPhone,
                type: 'text',
                message: personalizedMessage,
              }),
            });

            const resData = await response.json();
            console.log("[WhatsApp Broadcast] Raw response for", cleanPhone, ":", resData);

            if (response.ok && resData.success) {
              const parsedId = resData.data?.msgId || resData.data?.id || resData.id || resData.messageId;
              if (parsedId) messageId = String(parsedId);
              status = 'sent';
            } else {
              status = 'failed';
              errorMessage = resData.message || resData.error || `HTTP ${response.status} ${response.statusText}`;
              errorRawResponse = resData;
            }
          } catch (err) {
            console.error(`[WhatsApp Broadcast] Network exception for ${cleanPhone}:`, err);
            status = 'failed';
            errorMessage = err.message || 'Network exception calling Maytapi API';
            errorRawResponse = { error: String(err) };
          }
        }

        const nowIso = new Date().toISOString();

        // 1. Safe Contact Upsert (Preserves authentic WhatsApp name and avatar)
        const { data: existingContact } = await supabase
          .from('whatsapp_contacts')
          .select('name, avatar_url')
          .eq('id', cid)
          .single();

        const contactUpsertData = {
          id: cid,
          phone_number: cleanPhone,
          updated_at: nowIso,
        };

        if (!existingContact?.name) {
          contactUpsertData.name = emp.name || cleanPhone;
        }

        await supabase.from('whatsapp_contacts').upsert(contactUpsertData, { onConflict: 'id' });

        // 2. Upsert Conversation preview
        await supabase.from('whatsapp_conversations').upsert({
          id: cid,
          contact_id: cid,
          phone_id: PHONE_ID || 0,
          last_message_text: personalizedMessage,
          last_message_at: nowIso,
          updated_at: nowIso,
        }, { onConflict: 'id' });

        // 3. Upsert Message with actual status ('sent' or 'failed')
        await supabase.from('whatsapp_messages').upsert({
          id: messageId,
          conversation_id: cid,
          contact_id: cid,
          from_me: true,
          message_type: 'text',
          content: personalizedMessage,
          status: status,
          ack_code: status === 'sent' ? 1 : 0,
          timestamp: nowIso,
        }, { onConflict: 'id' });

        // 4. If sending failed, log error in whatsapp_delivery_error_logs
        if (status === 'failed' && errorMessage) {
          await supabase.from('whatsapp_delivery_error_logs').insert({
            message_id: messageId,
            conversation_id: cid,
            recipient_phone: cleanPhone,
            error_code: String(errorRawResponse?.code || 'SEND_FAILED'),
            error_message: errorMessage,
            raw_response: errorRawResponse,
          });
        }

        logsToInsert.push({
          campaign_id: campaignId,
          message_id: messageId,
          recipient_phone: cleanPhone,
          recipient_name: emp.name,
          status: status,
        });
      }

      if (logsToInsert.length > 0) {
        const { error: logsError } = await supabase
          .from('whatsapp_message_logs')
          .insert(logsToInsert);
        if (logsError) {
          console.error('Error inserting message logs to Supabase:', logsError);
        }
      }

      // 5. Reload history, reset inputs, and update stats counts
      await get().fetchBroadcastHistory();
      await get().fetchMessageStats();
      set({ attachments: [], composerText: '' });
    } catch (err) {
      console.error('Error logging broadcast campaign:', err);
      alert('Failed to log campaign to Supabase.');
    }
  },

  // ========================================================
  // WHATSAPP LIVE CONTROL ACTIONS
  // ========================================================
  setActiveDashboardTab: (tab) => set({ activeDashboardTab: tab }),
  setWhatsAppSearchQuery: (query) => set({ whatsappSearchQuery: query }),
  setIsNewContactModalOpen: (isOpen) => set({ isNewContactModalOpen: isOpen }),

  initGlobalWhatsAppRealtime: () => {
    if (get()._realtimeSubscribed) return;
    set({ _realtimeSubscribed: true });

    const channel = supabase
      .channel('global-whatsapp-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          console.log('[Global Realtime] whatsapp_messages change:', payload);
          get().fetchWhatsAppConversations();
          const currentCid = get().selectedConversationId;
          if (currentCid) {
            get().fetchWhatsAppMessages(currentCid);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          get().fetchWhatsAppConversations();
        }
      )
      .subscribe();

    return channel;
  },

  fetchWhatsAppConversations: async () => {
    try {
      const { data: convs, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          whatsapp_contacts (
            id,
            phone_number,
            name,
            avatar_url
          )
        `)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching whatsapp_conversations:', error);
        return;
      }

      set({ whatsappConversations: convs || [] });

      // Auto-select first conversation if none selected
      const currentSelected = get().selectedConversationId;
      if (!currentSelected && convs && convs.length > 0) {
        get().selectWhatsAppConversation(convs[0].id);
      }
    } catch (err) {
      console.error('Error in fetchWhatsAppConversations:', err);
    }
  },

  selectWhatsAppConversation: async (conversationId) => {
    set({ selectedConversationId: conversationId });

    // Reset unread count in DB when conversation is opened
    try {
      await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      // Update local state unread count
      set((state) => ({
        whatsappConversations: state.whatsappConversations.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch (e) {
      console.error('Failed to reset unread_count:', e);
    }

    await get().fetchWhatsAppMessages(conversationId);
  },

  fetchWhatsAppMessages: async (conversationId) => {
    if (!conversationId) return;
    try {
      const { data: msgs, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching whatsapp_messages:', error);
        return;
      }

      set({ whatsappMessages: msgs || [] });
    } catch (err) {
      console.error('Error in fetchWhatsAppMessages:', err);
    }
  },

  sendDirectWhatsAppMessage: async (text, mediaUrl = null) => {
    const activeCid = get().selectedConversationId;
    if (!activeCid || (!text && !mediaUrl)) return false;

    const PRODUCT_ID = import.meta.env.VITE_MAYTAPI_PRODUCT_ID;
    const PHONE_ID = import.meta.env.VITE_MAYTAPI_PHONE_ID;
    const TOKEN = import.meta.env.VITE_MAYTAPI_ACCESS_TOKEN;

    const { cleanPhone, cid } = formatWhatsAppNumber(activeCid);
    if (!cleanPhone || !cid) return false;

    const nowIso = new Date().toISOString();
    let messageId = `msg-${Date.now()}`;
    let status = 'failed';
    let errorMessage = null;
    let errorRawResponse = null;

    try {
      if (PRODUCT_ID && PHONE_ID && TOKEN) {
        const pid = String(PRODUCT_ID).trim();
        const phid = String(PHONE_ID).trim();
        const tok = String(TOKEN).trim();
        const url = `https://api.maytapi.com/api/${pid}/${phid}/sendMessage`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-maytapi-key': tok,
          },
          body: JSON.stringify({
            to_number: cleanPhone,
            type: mediaUrl ? 'media' : 'text',
            message: mediaUrl ? mediaUrl : text,
          }),
        });

        const resData = await response.json();
        console.log('[WhatsApp Direct Send] Response:', resData);

        if (response.ok && resData.success) {
          const parsedId = resData.data?.msgId || resData.data?.id || resData.id;
          if (parsedId) messageId = String(parsedId);
          status = 'sent';
        } else {
          status = 'failed';
          errorMessage = resData.message || resData.error || `HTTP ${response.status}`;
          errorRawResponse = resData;
        }
      }

      // Save message to Supabase DB
      const newMessageRow = {
        id: messageId,
        conversation_id: activeCid,
        contact_id: activeCid,
        from_me: true,
        message_type: mediaUrl ? 'media' : 'text',
        content: text || mediaUrl,
        media_url: mediaUrl || null,
        status: status,
        ack_code: status === 'sent' ? 1 : 0,
        timestamp: nowIso,
      };

      await supabase.from('whatsapp_messages').upsert(newMessageRow, { onConflict: 'id' });

      // Safe Contact Upsert (Preserves authentic WhatsApp name and avatar)
      const { data: existingContact } = await supabase
        .from('whatsapp_contacts')
        .select('name, avatar_url')
        .eq('id', activeCid)
        .single();

      const contactUpsertData = {
        id: activeCid,
        phone_number: cleanPhone,
        updated_at: nowIso,
      };

      if (!existingContact?.name) {
        contactUpsertData.name = cleanPhone;
      }

      await supabase.from('whatsapp_contacts').upsert(contactUpsertData, { onConflict: 'id' });

      // Update Conversation Preview
      await supabase.from('whatsapp_conversations').upsert({
        id: activeCid,
        contact_id: activeCid,
        phone_id: PHONE_ID || 0,
        last_message_text: text || '[Media]',
        last_message_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'id' });

      // If failed, insert error log into whatsapp_delivery_error_logs
      if (status === 'failed' && errorMessage) {
        await supabase.from('whatsapp_delivery_error_logs').insert({
          message_id: messageId,
          conversation_id: activeCid,
          recipient_phone: cleanPhone,
          error_code: String(errorRawResponse?.code || 'SEND_FAILED'),
          error_message: errorMessage,
          raw_response: errorRawResponse,
        });
      }

      // Optimistically append to local state
      set((state) => ({
        whatsappMessages: [...state.whatsappMessages, newMessageRow],
      }));

      await get().fetchWhatsAppConversations();
      return status === 'sent';
    } catch (err) {
      console.error('Failed to send direct WhatsApp message:', err);
      return false;
    }
  },

  startNewWhatsAppChat: async (phoneNumber, contactName) => {
    if (!phoneNumber) return;
    const { cleanPhone, cid } = formatWhatsAppNumber(phoneNumber);
    if (!cleanPhone || !cid) return;

    const nowIso = new Date().toISOString();
    const PHONE_ID = import.meta.env.VITE_MAYTAPI_PHONE_ID || 0;

    try {
      // 1. Upsert Contact
      await supabase.from('whatsapp_contacts').upsert({
        id: cid,
        phone_number: cleanPhone,
        name: contactName || cleanPhone,
        updated_at: nowIso,
      }, { onConflict: 'id' });

      // 2. Upsert Conversation
      await supabase.from('whatsapp_conversations').upsert({
        id: cid,
        contact_id: cid,
        phone_id: PHONE_ID,
        last_message_text: 'Chat started',
        last_message_at: nowIso,
        unread_count: 0,
        updated_at: nowIso,
      }, { onConflict: 'id' });

      // 3. Re-fetch conversations list & select new chat
      await get().fetchWhatsAppConversations();
      await get().selectWhatsAppConversation(cid);
      set({ isNewContactModalOpen: false });
    } catch (err) {
      console.error('Error starting new chat:', err);
    }
  },

  updateWhatsAppContactName: async (cid, newName) => {
    if (!cid || !newName) return;
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({
          name: newName,
          updated_at: nowIso,
        })
        .eq('id', cid);

      if (error) throw error;

      await get().fetchWhatsAppConversations();
    } catch (err) {
      console.error('Failed to update contact name:', err);
      throw err;
    }
  },
}))
