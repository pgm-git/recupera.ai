import openai
import os
import json
import httpx
from typing import List, Dict, Any
from supabase import create_client, Client

# Validate required env vars
_required_env = ["OPENAI_API_KEY", "UAZAPI_BASE_URL", "UAZAPI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
for _var in _required_env:
    if not os.environ.get(_var):
        raise RuntimeError(f"Missing required environment variable: {_var}")

# Configurações
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
UAZAPI_BASE_URL = os.environ["UAZAPI_BASE_URL"]
UAZAPI_API_KEY = os.environ["UAZAPI_API_KEY"]

# Supabase Setup
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai.api_key = OPENAI_API_KEY

SYSTEM_PROMPT_TEMPLATE = """
Você é um especialista em recuperação de vendas do produto {product_name}.
Seu nome é {agent_name}.

CONTEXTO:
O cliente {lead_name} iniciou o checkout mas não finalizou.
Link de Checkout: {checkout_url}
Preço do produto: R$ {product_price}

SUA MISSÃO:
Descobrir educadamente por que ele não comprou e tentar reverter.
Use a técnica de vendas: Empatia -> Sondagem -> Solução.

DIRETRIZES DE COMPORTAMENTO:
- Persona: {agent_persona}
- Tratamento de Objeções: {objection_handling}
- Link de Downsell (OFERECER APENAS SE A OBJEÇÃO FOR PREÇO): {downsell_link}

REGRAS RÍGIDAS:
1. Respostas curtas e naturais para WhatsApp (máx 2 frases).
2. NUNCA invente dados que não estão aqui.
3. Se o cliente disser que já comprou, parabenize e encerre.
4. Se o cliente for rude ou pedir para parar, peça desculpas e encerre.
5. Aguarde a resposta do cliente antes de mandar a próxima info.
"""

async def process_conversation_step(phone_number: str, incoming_message: str, instance_key: str):
    """
    Função Mestre: Recebe mensagem do usuário, processa IA e responde.
    """
    print(f"[AI AGENT] Processando mensagem de {phone_number}: {incoming_message}")

    # 1. Identificar o Lead pelo telefone
    # Nota: Removemos caracteres não numéricos para garantir o match
    clean_phone = ''.join(filter(str.isdigit, phone_number))
    
    # Busca lead pendente ou contactado que contenha esse telefone
    # (A query ideal deve lidar com formatação, aqui faremos um like simples para MVP)
    response = supabase.table("leads").select("*").ilike("phone", f"%{clean_phone}%").execute()
    
    if not response.data:
        print(f"[AI AGENT] Lead não encontrado para o telefone {clean_phone}")
        return
    
    # Pega o lead mais recente
    lead = response.data[0]
    lead_id = lead['id']

    # Se já foi convertido ou falhou, ignoramos (Kill Switch de resposta)
    if lead['status'] in ['converted_organically', 'recovered_by_ai', 'failed']:
        print(f"[AI AGENT] Lead {lead_id} já finalizado. Status: {lead['status']}")
        return

    # 2. Buscar Dados do Produto
    prod_res = supabase.table("products").select("*").eq("id", lead['product_id']).execute()
    if not prod_res.data:
        print("[AI AGENT] Produto não encontrado.")
        return
    product = prod_res.data[0]

    # 3. Atualizar Histórico (User Message)
    current_log = lead.get('conversation_log') or []
    current_log.append({"role": "user", "content": incoming_message})

    # 4. Construir Prompt para OpenAI
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        product_name=product.get('name', 'Produto'),
        agent_name="Assistente",
        lead_name=lead.get('name', 'Cliente'),
        checkout_url=lead.get('checkout_url', product.get('external_product_id')),
        product_price=lead.get('value', 'não informado'),
        agent_persona=product.get('agent_persona', 'Amigável e prestativo'),
        objection_handling=product.get('objection_handling', 'Foque no valor agregado'),
        downsell_link=product.get('downsell_link', 'Não disponível')
    )

    messages = [{"role": "system", "content": system_prompt}]
    
    # Adiciona histórico recente (últimas 6 mensagens para economizar tokens e manter contexto)
    messages.extend(current_log[-6:])

    try:
        # 5. Chamada OpenAI
        print("[AI AGENT] Chamando OpenAI...")
        gpt_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=150,
            temperature=0.7,
            presence_penalty=0.6 # Evita repetições
        )
        
        ai_reply = gpt_response.choices[0].message.content.strip()
        print(f"[AI AGENT] Resposta gerada: {ai_reply}")

        # 6. Enviar resposta via UAZAPI
        await send_message_uazapi(instance_key, phone_number, ai_reply)

        # 7. Atualizar Histórico no Banco (AI Message)
        current_log.append({"role": "assistant", "content": ai_reply})
        
        # Define novo status (se IA detectou recuperação, poderíamos usar function calling aqui, mas vamos manter simples)
        new_status = 'contacted'
        
        supabase.table("leads").update({
            "conversation_log": current_log,
            "status": new_status,
            "updated_at": "now()" # Importante para saber ultima interação
        }).eq("id", lead_id).execute()

    except Exception as e:
        print(f"[AI AGENT CRITICAL ERROR] {e}")

async def send_message_uazapi(instance_key: str, phone: str, text: str):
    """ Envia a requisição HTTP para a UAZAPI """
    url = f"{UAZAPI_BASE_URL}/message/text"
    headers = {
        "apikey": UAZAPI_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "instanceName": instance_key,
        "number": phone,
        "text": text
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
            if resp.status_code != 200:
                print(f"[UAZAPI ERROR] Status: {resp.status_code} - Body: {resp.text}")
            else:
                print(f"[UAZAPI SENT] Para: {phone}")
        except Exception as e:
            print(f"[UAZAPI CONNECTION ERROR] {e}")
