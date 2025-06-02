# Supabase Edge Functions Documentation

This directory contains all Supabase Edge Functions for the Stay Connected application. This document provides an analysis of each function, their usage status, and cleanup recommendations.

## 📊 Function Overview

The Stay Connected app currently has **9 edge functions** across different functional areas:

- **Core App Functions**: 3 functions (check-in, monitoring, notifications)
- **Payment Functions**: 3 functions (checkout, plans, webhooks)
- **Legacy/Test Functions**: 3 functions (potentially unused)

## 📋 Function Analysis

### ✅ **ACTIVELY USED Functions**

#### 1. `check-in/`
- **Purpose**: Handles user check-ins for events
- **Status**: ✅ **ACTIVE** - Core functionality
- **Used by**: `src/components/check-in-dashboard.tsx`
- **Functionality**:
  - Updates event `last_check_in` timestamp
  - Sets event status to "running"
  - Clears pending notifications
  - Logs activity to audit trail
- **Dependencies**: Requires `SUPABASE_SERVICE_ROLE_KEY`

#### 2. `check-inactivity/`
- **Purpose**: Monitors events for missed check-ins and creates notification logs
- **Status**: ✅ **ACTIVE** - Core monitoring system
- **Used by**: 
  - Database function `invoke_check_inactivity()`
  - Cron jobs for automated monitoring
- **Functionality**:
  - Phase 1: Log user reminders for overdue check-ins
  - Phase 2: Log contact alerts when threshold exceeded
  - Phase 3: Trigger events when severely overdue
- **Dependencies**: `SENDGRID_API_KEY`, `TELNYX_API_KEY`, `EXPO_ACCESS_TOKEN`

#### 3. `send-notification/`
- **Purpose**: Processes and sends email/SMS/push notifications
- **Status**: ✅ **ACTIVE** - Core notification system
- **Used by**: 
  - Database function `invoke_send_notifications()`
  - Cron jobs for automated notification processing
- **Functionality**:
  - Fetches pending notifications from database
  - Sends emails via SendGrid API
  - Sends SMS via Telnyx API
  - Sends push notifications via Expo
  - Updates notification status in database
- **Dependencies**: `SENDGRID_API_KEY`, `TELNYX_API_KEY`, `EXPO_ACCESS_TOKEN`

#### 4. `create-checkout/`
- **Purpose**: Creates Stripe checkout sessions for subscriptions
- **Status**: ✅ **ACTIVE** - Payment functionality
- **Used by**: `src/components/pricing-card.tsx`
- **Functionality**:
  - Creates Stripe checkout sessions
  - Handles subscription purchases
  - Redirects to Stripe payment flow
- **Dependencies**: `STRIPE_SECRET_KEY`

#### 5. `get-plans/`
- **Purpose**: Retrieves available Stripe subscription plans
- **Status**: ✅ **ACTIVE** - Pricing display
- **Used by**: 
  - `src/app/pricing/page.tsx`
  - `src/app/page.tsx`
- **Functionality**:
  - Fetches active Stripe plans
  - Returns plan data for pricing display
- **Dependencies**: `STRIPE_SECRET_KEY`

#### 6. `payments-webhook/`
- **Purpose**: Handles Stripe webhook events for subscription management
- **Status**: ✅ **ACTIVE** - Critical for payments
- **Used by**: Stripe webhook system
- **Functionality**:
  - Processes subscription created/updated/deleted events
  - Handles checkout session completion
  - Manages invoice payment events
  - Updates subscription status in database
- **Dependencies**: `STRIPE_SECRET_KEY`, Supabase service role

### ❓ **POTENTIALLY UNUSED Functions**

#### 7. `send-notification-enhanced/`
- **Purpose**: Enhanced notification processing with more complex logic
- **Status**: ⚠️ **CANDIDATE FOR REMOVAL**
- **Analysis**: 
  - No references found in codebase
  - Appears to be superseded by `send-notification`
  - Contains more complex notification rules logic
  - **Recommendation**: Remove if confirmed unused

#### 8. `schedule-check-inactivity/`
- **Purpose**: Wrapper function to schedule the check-inactivity function
- **Status**: ⚠️ **CANDIDATE FOR REMOVAL**
- **Analysis**:
  - No frontend references found
  - May have been replaced by direct cron job calls
  - Contains logic to invoke `check-inactivity` function
  - **Recommendation**: Remove if cron jobs call `check-inactivity` directly

#### 9. `test-env/`
- **Purpose**: Environment variable testing
- **Status**: ❌ **REMOVE** - Empty directory
- **Analysis**:
  - Directory exists but contains no files
  - Appears to be leftover from development
  - **Recommendation**: Safe to remove immediately

## 🔗 Function Dependencies

### Database Functions Integration
```sql
-- These database functions call edge functions:
invoke_check_inactivity() → calls check-inactivity/
invoke_send_notifications() → calls send-notification/
```

### Cron Job Integration
```sql
-- Scheduled jobs (from migrations):
'process-notifications' → calls invoke_send_notifications()
```

### Frontend Integration
```typescript
// Direct function calls from frontend:
supabase.functions.invoke("check-in", ...)           // check-in dashboard
supabase.functions.invoke("create-checkout", ...)    // pricing page
supabase.functions.invoke("get-plans", ...)          // pricing display
```

## 📦 Required Environment Variables

### Core App Functions
```env
# Required for check-inactivity and send-notification
SENDGRID_API_KEY=           # Email notifications
TELNYX_API_KEY=             # SMS notifications  
EXPO_ACCESS_TOKEN=          # Push notifications
FROM_EMAIL=                 # Sender email address
FROM_PHONE=                 # Sender phone number

# Required for all functions
SUPABASE_URL=               # Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=  # Service role key for database access
```

### Payment Functions
```env
# Required for create-checkout, get-plans, payments-webhook
STRIPE_SECRET_KEY=          # Stripe API secret key
```

## 🧹 Cleanup Recommendations

### Immediate Actions
1. **Remove `test-env/`** - Empty directory, safe to delete
2. **Verify `schedule-check-inactivity/` usage** - Check if still needed
3. **Verify `send-notification-enhanced/` usage** - Check if superseded

### Verification Steps
Before removing potentially unused functions:

1. **Check cron jobs**: Verify what functions are scheduled
   ```sql
   SELECT * FROM cron.job;
   ```

2. **Check database function calls**: Look for edge function invocations
   ```sql
   -- Search for function calls in database functions
   SELECT routine_definition 
   FROM information_schema.routines 
   WHERE routine_definition LIKE '%functions/v1%';
   ```

3. **Check production logs**: Review edge function invocation logs

### Safe Removal Process
1. **Backup function code** before deletion
2. **Monitor logs** for any missing function errors
3. **Remove from least critical to most critical**
4. **Update documentation** after removal

## 📊 Function Performance & Costs

### High-Frequency Functions
- `send-notification/` - Called every minute via cron
- `check-inactivity/` - Called every minute via cron

### Low-Frequency Functions
- `check-in/` - Called on user action
- `create-checkout/` - Called on subscription purchase
- `get-plans/` - Called on page load
- `payments-webhook/` - Called by Stripe events

## 🔧 Maintenance Notes

### Regular Tasks
- **Monitor function logs** for errors
- **Update environment variables** as needed
- **Review function performance** monthly
- **Update dependencies** for security patches

### Known Issues
- Some functions contain hardcoded service role keys (should use env vars)
- Error handling could be improved in some functions
- Consider rate limiting for high-frequency functions

## 📈 Future Improvements

1. **Consolidate notification functions** - Consider merging enhanced and standard versions
2. **Add rate limiting** - Prevent abuse of public functions
3. **Improve error handling** - Standardize error responses
4. **Add monitoring** - Implement function health checks
5. **Optimize performance** - Reduce cold start times

---

**Last Updated**: June 1, 2025  
**Total Functions**: 9 (6 active, 3 candidates for removal)  
**Next Review**: July 1, 2025 