import axios from 'axios';

const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || '';
const UAZAPI_API_KEY = process.env.UAZAPI_API_KEY || '';

export async function sendMessageUazapi(instanceKey: string, phone: string, text: string): Promise<void> {
  const url = `${UAZAPI_BASE_URL}/message/text`;
  const headers = {
    apikey: UAZAPI_API_KEY,
    'Content-Type': 'application/json',
  };
  const payload = {
    instanceName: instanceKey,
    number: phone,
    text,
  };

  try {
    const resp = await axios.post(url, payload, { headers, timeout: 10000 });
    if (resp.status !== 200) {
      console.error(`[UAZAPI ERROR] Status: ${resp.status} - Body: ${JSON.stringify(resp.data)}`);
    } else {
      console.log(`[UAZAPI SENT] Para: ${phone}`);
    }
  } catch (error) {
    console.error(`[UAZAPI CONNECTION ERROR] ${error}`);
  }
}
