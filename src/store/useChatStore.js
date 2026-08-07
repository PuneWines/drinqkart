import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const DEFAULT_BROADCAST_TEXT = `Dear {{Employee Name}},

Today's stock audit will begin at 7:00 PM.

Please submit your daily sales report before 6:30 PM.

Thanks,
Management`

const INITIAL_ATTACHMENTS = [
  { id: 'att-1', name: 'SalesReport.pdf', size: '2.3 MB', icon: '📄', type: 'application/pdf' },
]

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

      // 2. Fetch active users (employees) from Supabase
      const { data: usersDb, error: usersErr } = await supabase
        .from('users')
        .select('id, user_name, number, role, shop_name, status')
        .eq('status', 'active')
        .order('user_name', { ascending: true });

      if (usersErr) throw usersErr;

      // 3. Group and map users to shops
      const mappedShops = (shopsDb || []).map((shop) => {
        const shopEmployees = (usersDb || [])
          .filter((u) => u.shop_name === shop.shop_name)
          .map((u) => ({
            id: u.id.toString(), // Stringified for safe string-comparison in UI checkboxes
            name: u.user_name || 'Unnamed',
            role: u.role || 'Staff',
            phone: u.number || '',
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
        const toNumber = emp.phone;
        if (!toNumber) continue;

        const personalizedMessage = composerText.replace(/\{\{Employee Name\}\}/g, emp.name);
        let messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let status = 'failed';

        if (PRODUCT_ID && PHONE_ID && TOKEN) {
          try {
            const url = `https://api.maytapi.com/api/${PRODUCT_ID}/${PHONE_ID}/sendMessage`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-maytapi-key': TOKEN,
              },
              body: JSON.stringify({
                to_number: toNumber,
                type: 'text',
                message: personalizedMessage,
              }),
            });

            if (response.ok) {
              const resData = await response.json();
              console.log("[WhatsApp] Maytapi raw response for", toNumber, ":", resData);
              
              // Extract message ID from various possible locations in Maytapi response
              const parsedId = resData.data?.id || resData.data?.messageId || resData.id || resData.messageId;
              
              if (parsedId) {
                messageId = String(parsedId);
                status = 'sent';
              } else if (resData.success || resData.status === 'success') {
                status = 'sent';
              }
            } else {
              console.error("[WhatsApp] Maytapi response not OK:", response.status, response.statusText);
            }
          } catch (err) {
            console.error(`[WhatsApp] Failed to send message to ${toNumber}:`, err);
          }
        } else {
          status = 'sent';
        }

        logsToInsert.push({
          campaign_id: campaignId,
          message_id: messageId,
          recipient_phone: toNumber,
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
}))
