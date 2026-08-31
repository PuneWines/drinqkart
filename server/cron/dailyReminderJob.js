/* global process */
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const WHATSAPP_API_URL = 'https://api.maytapi.com/api';
const WHATSAPP_PRODUCT_ID = process.env.VITE_WHATSAPP_PRODUCT_ID || process.env.VITE_MAYTAPI_PRODUCT_ID;
const WHATSAPP_PHONE_NUMBER_ID = process.env.VITE_WHATSAPP_PHONE_NUMBER_ID || process.env.VITE_MAYTAPI_PHONE_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.VITE_WHATSAPP_ACCESS_TOKEN || process.env.VITE_MAYTAPI_ACCESS_TOKEN || process.env.VITE_MAYTAPI_TOKEN;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    return cleaned;
};

const sendWhatsAppMessage = async (phoneNumber, message, contactName = null) => {
    try {
        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (!formattedPhone) return false;

        const cid = `${formattedPhone}@c.us`;
        const nowIso = new Date().toISOString();
        let messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let status = 'failed';
        let errorMessage = null;
        let errorRawResponse = null;

        // 1. Post to Maytapi API
        if (WHATSAPP_PRODUCT_ID && WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN) {
            const url = `${WHATSAPP_API_URL}/${WHATSAPP_PRODUCT_ID}/${WHATSAPP_PHONE_NUMBER_ID}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-maytapi-key': WHATSAPP_ACCESS_TOKEN,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to_number: formattedPhone,
                    type: 'text',
                    message: message
                })
            });

            const resData = await response.json();
            if (response.ok && resData.success) {
                const parsedId = resData.data?.msgId || resData.data?.id || resData.id || resData.messageId;
                if (parsedId) messageId = String(parsedId);
                status = 'sent';
            } else {
                status = 'failed';
                errorMessage = resData.message || resData.error || `HTTP ${response.status} ${response.statusText}`;
                errorRawResponse = resData;
            }
        } else {
            errorMessage = 'Maytapi API credentials not configured in environment';
        }

        // 2. Safe Contact Upsert - preserve existing name if already present in DB
        const { data: existingContact } = await supabase
            .from('whatsapp_contacts')
            .select('name')
            .eq('id', cid)
            .maybeSingle();

        const contactUpsertData = {
            id: cid,
            phone_number: formattedPhone,
            updated_at: nowIso,
        };

        if (!existingContact?.name) {
            contactUpsertData.name = contactName || formattedPhone;
        }

        await supabase.from('whatsapp_contacts').upsert(contactUpsertData, { onConflict: 'id' });

        // 3. Upsert Conversation Thread
        await supabase.from('whatsapp_conversations').upsert({
            id: cid,
            contact_id: cid,
            phone_id: WHATSAPP_PHONE_NUMBER_ID || 0,
            last_message_text: message,
            last_message_at: nowIso,
            updated_at: nowIso,
        }, { onConflict: 'id' });

        // 4. Upsert Message Record
        const newMessageRow = {
            id: messageId,
            conversation_id: cid,
            contact_id: cid,
            from_me: true,
            message_type: 'text',
            content: message,
            media_url: null,
            status: status,
            ack_code: status === 'sent' ? 1 : 0,
            timestamp: nowIso,
        };

        await supabase.from('whatsapp_messages').upsert(newMessageRow, { onConflict: 'id' });

        // 5. Log Error if failed
        if (status === 'failed' && errorMessage) {
            await supabase.from('whatsapp_delivery_error_logs').insert({
                message_id: messageId,
                conversation_id: cid,
                recipient_phone: formattedPhone,
                error_code: String(errorRawResponse?.code || 'SEND_FAILED'),
                error_message: errorMessage,
                raw_response: errorRawResponse,
            });
        }

        if (status === 'sent') {
            console.log('✅ Daily reminder WhatsApp message sent to:', formattedPhone);
        } else {
            console.error('❌ Daily reminder WhatsApp message failed for:', formattedPhone, errorMessage);
        }

        return status === 'sent';
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return false;
    }
};

export const runDailyReminders = async () => {
    console.log('⏳ Running Daily Task Reminder...');
    try {
        // 1. Fetch all users
        const { data: users, error: userError } = await supabase.from('users').select('user_name, number');
        if (userError || !users) {
            console.error('Error fetching users:', userError);
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        for (const user of users) {
            if (!user.user_name || !user.number) continue;
            
            const name = user.user_name;
            let pendingCount = 0;

            // 2. Count Pending Tasks from all tables
            // Checklist
            const { count: checklistCount } = await supabase.from('checklist')
                .select('*', { count: 'exact', head: true })
                .is('submission_date', null)
                .lte('planned_date', `${today}T23:59:59`)
                .eq('name', name);
            
            // Delegation
            const { count: delegationCount } = await supabase.from('delegation')
                .select('*', { count: 'exact', head: true })
                .is('submission_date', null)
                .neq('status', 'done')
                .lte('planned_date', `${today}T23:59:59`)
                .eq('name', name);

            // Maintenance
            const { count: maintenanceCount } = await supabase.from('maintenance_tasks')
                .select('*', { count: 'exact', head: true })
                .is('submission_date', null)
                .lte('planned_date', `${today}T23:59:59`)
                .eq('name', name);

            // Repair
            const { count: repairCount } = await supabase.from('repair_tasks')
                .select('*', { count: 'exact', head: true })
                .is('submission_date', null)
                .lte('planned_date', `${today}T23:59:59`)
                .eq('assigned_person', name);

            // Work Tasks (Using work_task_new)
            const { count: workCount } = await supabase.from('work_task_new')
                .select('*', { count: 'exact', head: true })
                .is('submission_date', null)
                .not('work_status', 'in', '(Done,SUBMITTED,done,APPROVED,Approved,submitted,MANAGER_APPROVED,ADMIN_APPROVED)')
                .lte('current_date', today)
                .eq('name', name);

            // EA Tasks
            const { count: eaCount } = await supabase.from('ea_tasks')
                .select('*', { count: 'exact', head: true })
                .in('status', ['pending', 'extend', 'extended', 'Pending'])
                .lte('planned_date', `${today}T23:59:59`)
                .eq('doer_name', name);

            pendingCount = (checklistCount || 0) + 
                           (delegationCount || 0) + 
                           (maintenanceCount || 0) + 
                           (repairCount || 0) + 
                           (workCount || 0) + 
                           (eaCount || 0);

            if (pendingCount > 0) {
                const message = `☀️ *Daily Task Reminder*\n\n` +
                    `Hi ${name},\n` +
                    `You have *${pendingCount} pending task(s)* today.\n\n` +
                    `🔗 View tasks: https://drinqkart.com/login\n\n` +
                    `_Drinqkart_`;

                await sendWhatsAppMessage(user.number, message, name);
                // Add slight delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        console.log('✅ Daily Task Reminder Finished!');

    } catch (error) {
        console.error('Error executing reminders:', error);
    }
};

export const startDailyRemindersCron = () => {
    // Schedule task between 9 am and 10 am, e.g., 9:30 AM every day
    console.log('⏰ Initializing Daily Task Reminder Cron Job (runs at 09:30 AM)');

    cron.schedule('30 9 * * *', async () => {
        await runDailyReminders();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
};
