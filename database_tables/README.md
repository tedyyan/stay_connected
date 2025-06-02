# Stay Connected Database Schema Documentation

This directory contains the complete database schema for the Stay Connected application, exported on June 1, 2025. The schema represents the current production state of the database.

## Database Overview

The Stay Connected app is a check-in monitoring system that helps users track their safety through regular check-ins and automatically alerts emergency contacts when check-ins are missed.

## Database Files

### Complete Schema
- **`current_database_schema.sql`** - Complete PostgreSQL dump of the entire database schema including all tables, functions, policies, and permissions

### Individual Table Files
- **`01_users_table.sql`** - User profile information linked to Supabase auth
- **`02_events_table.sql`** - Check-in events that users create to monitor their activity
- **`03_contacts_table.sql`** - Emergency contact information for notifications
- **`04_event_contacts_table.sql`** - Junction table managing many-to-many relationship between events and contacts
- **`05_notification_logs_table.sql`** - Tracks all notifications sent by the system
- **`06_activity_logs_table.sql`** - Audit log of user actions and system events
- **`07_user_api_keys_table.sql`** - Third-party API keys for users (SendGrid, Telnyx, etc.)
- **`08_functions.sql`** - All database functions for business logic

## Table Relationships

```
auth.users (Supabase Auth)
    ↓
users (id) ←─┐
    ↓        │
events (user_id) ←─┐
    ↓             │
notification_logs (event_id)
    ↓             │
activity_logs (user_id, event_id)
                  │
contacts (user_id) ←─┘
    ↓
event_contacts (event_id, contact_id)
    ↓
user_api_keys (user_id)
```

## Core Tables

### 1. Users (`users`)
- **Purpose**: Stores user profile information linked to Supabase authentication
- **Key Fields**: `id`, `email`, `phone`, `full_name`, `subscription`, `credits`
- **Relationships**: Links to `auth.users`, parent to all other user-owned data

### 2. Events (`events`)
- **Purpose**: Represents check-in monitoring events created by users
- **Key Fields**: `name`, `status`, `check_in_frequency`, `last_check_in`, `notification_content`
- **Status Values**: `running`, `paused`, `triggered`, `deleted`
- **Relationships**: Belongs to `users`, has many `notification_logs` and `activity_logs`

### 3. Contacts (`contacts`)
- **Purpose**: Emergency contacts who receive alerts when check-ins are missed
- **Key Fields**: `name`, `email`, `phone`, `social_media`
- **Relationships**: Belongs to `users`, linked to `events` through `event_contacts`

### 4. Event Contacts (`event_contacts`)
- **Purpose**: Junction table linking events to their associated emergency contacts
- **Key Fields**: `event_id`, `contact_id`
- **Relationships**: Many-to-many between `events` and `contacts`

### 5. Notification Logs (`notification_logs`)
- **Purpose**: Tracks all notifications sent by the system
- **Key Fields**: `notification_type`, `recipient`, `content`, `status`, `notification_category`
- **Categories**: `user_reminder`, `contact_alert`, `event_trigger`
- **Types**: `email`, `sms`, `push`

### 6. Activity Logs (`activity_logs`)
- **Purpose**: Audit trail of user actions and system events
- **Key Fields**: `action`, `details`, `created_at`
- **Relationships**: Belongs to `users`, optionally linked to `events`

### 7. User API Keys (`user_api_keys`)
- **Purpose**: Stores third-party API keys for external services
- **Key Fields**: `sendgrid_api_key`, `telnyx_api_key`
- **Relationships**: One-to-one with `users`

## Key Database Functions

### Notification Functions
- **`create_contact_alert_notification()`** - Creates notification logs for emergency contact alerts
- **`create_user_reminder_notification()`** - Creates notification logs for user reminders
- **`get_events_needing_contact_alerts()`** - Finds events that need emergency contact notifications
- **`get_events_needing_user_reminders()`** - Finds events that need user reminder notifications

### Utility Functions
- **`backfill_missing_users()`** - Syncs auth.users with public.users table
- **`handle_new_user()`** - Trigger function for new user registration
- **`needs_checkin()`** - Checks if an event requires a check-in
- **`update_event_contacts()`** - Manages event-contact relationships
- **`interval_to_seconds()`** - Converts interval strings to seconds

## Security & Permissions

### Row Level Security (RLS)
All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Cross-table access is properly validated through relationships
- Service role has full access for system operations

### API Access
- **anon**: Read access to public data
- **authenticated**: Full CRUD on user's own data
- **service_role**: Full access for system operations

## Data Flow

1. **User Registration**: New users are automatically created in `users` table via `handle_new_user()` trigger
2. **Event Creation**: Users create events with associated emergency contacts
3. **Check-in Monitoring**: System monitors events and detects missed check-ins
4. **Notification Processing**: 
   - User reminders sent to event owner
   - Contact alerts sent to emergency contacts
   - All notifications logged in `notification_logs`
5. **Activity Tracking**: User actions logged in `activity_logs` for audit purposes

## Current Migration Status

The database schema represents the latest migration state as of June 1, 2025. All previous migrations have been applied and are captured in the `supabase/migrations/` directory. This export captures the final state without needing to reverse any changes.

## Usage Notes

- **Check-in Frequency**: Configurable per event (default: 1 hour)
- **Notification Categories**: Used to prevent spam and manage notification timing
- **Soft Deletes**: Events use `deleted` flag rather than hard deletion
- **Status Management**: Events can be paused/muted to stop notifications temporarily 