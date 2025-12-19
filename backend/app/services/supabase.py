from supabase import create_client, Client
from app.config import get_settings


def get_supabase_client() -> Client:
    """Get Supabase client with anon key for user operations."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_admin_client() -> Client:
    """Get Supabase client with service role key for admin operations."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
