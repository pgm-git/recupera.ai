from celery import Celery
import os
from supabase import create_client
import ai_handler # Importando o módulo criado
import httpx
import asyncio

# Validate required env vars
_required_env = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "UAZAPI_BASE_URL", "UAZAPI_API_KEY"]
for _var in _required_env:
    if not os.environ.get(_var):
        raise RuntimeError(f"Missing required environment variable: {_var}")

# Configuração Celery
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
celery = Celery("tasks", broker=redis_url, backend=redis_url)

# Supabase Client
url: str = os.environ["SUPABASE_URL"]
key: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(url, key)

# UAZAPI Config
UAZAPI_BASE_URL = os.environ["UAZAPI_BASE_URL"]
UAZAPI_API_KEY = os.environ["UAZAPI_API_KEY"]

async def send_whatsapp_async(instance_key: str, phone: str, message: str):
    """Função auxiliar assíncrona para envio"""
    headers = {"apikey": UAZAPI_API_KEY, "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{UAZAPI_BASE_URL}/message/text",
            headers=headers,
            json={
                "instanceName": instance_key,
                "number": phone,
                "text": message
            }
        )

@celery.task(name="schedule_recovery")
def schedule_recovery(lead_id: str):
    print(f"[Worker] Processando Lead {lead_id}")
    
    # 1. Busca Lead e Verifica Kill Switch
    lead_res = supabase.table("leads").select("*").eq("id", lead_id).execute()
    if not lead_res.data:
        return "lead_not_found"
    lead = lead_res.data[0]
    
    if lead['status'] != 'pending_recovery':
        print(f"[Worker] Kill Switch: Lead status é {lead['status']}")
        return "aborted_kill_switch"

    # 2. Busca Produto e Configurações de IA
    prod_res = supabase.table("products").select("*").eq("id", lead['product_id']).execute()
    if not prod_res.data:
        return "product_not_found"
    product = prod_res.data[0]

    # 3. Busca Instância Conectada (Instance Key)
    # A instância está na tabela 'instances' vinculada ao 'client_id' do lead
    inst_res = supabase.table("instances").select("instance_key, status").eq("client_id", lead['client_id']).eq("status", "connected").execute()
    
    if not inst_res.data:
        print("[Worker] Nenhuma instância WhatsApp conectada para este cliente.")
        return "no_whatsapp_instance"
    
    instance_key = inst_res.data[0]['instance_key']

    # 4. Gera Mensagem com IA (Fase 3)
    # Passa histórico vazio pois é a primeira mensagem
    try:
        message = ai_handler.generate_message(lead, product, [])
    except Exception as e:
        print(f"[Worker] Erro IA: {e}")
        message = f"Olá {lead['name']}, vi que não concluiu a compra do {product['name']}."

    # 5. Envia WhatsApp (UAZAPI)
    if UAZAPI_API_KEY:
        try:
            # Celery roda em sync, precisamos rodar o async do httpx
            loop = asyncio.get_event_loop()
            loop.run_until_complete(send_whatsapp_async(instance_key, lead['phone'], message))
        except Exception as e:
            print(f"[Worker] Erro envio UAZAPI: {e}")
            return "failed_send"
    else:
        print(f"[MOCK UAZAPI] Enviando para {lead['phone']} via {instance_key}: {message}")

    # 6. Atualiza Status e Log
    new_log = lead.get('conversation_log', []) or []
    new_log.append({"role": "assistant", "content": message, "timestamp": "now"})
    
    supabase.table("leads").update({
        "status": "contacted",
        "conversation_log": new_log
    }).eq("id", lead_id).execute()

    return "success_sent"