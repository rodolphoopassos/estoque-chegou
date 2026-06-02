/**
 * Serviço de leitura de NF-e / Cupom Fiscal via API do servidor.
 * O frontend envia a imagem em base64 para o backend, que faz a chamada ao Gemini.
 * Isso mantém a API key segura no servidor.
 */

export async function processarNotaFiscal(imageFile: File): Promise<{
  fornecedor: string;
  total: number;
  itens: Array<{
    nome: string;
    quantidade: number;
    unidade: string;
    precoUnitario: number;
    totalItem: number;
  }>;
}> {
  // Converter arquivo para Base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });

  // Enviar para a API do servidor
  const response = await fetch('/api/ler-nfe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: base64Data,
      mimeType: imageFile.type || 'image/jpeg',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido do servidor.' }));
    throw new Error(errorData.error || `Erro do servidor (${response.status})`);
  }

  const data = await response.json();
  return data;
}
