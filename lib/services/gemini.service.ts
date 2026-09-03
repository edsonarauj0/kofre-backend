import pdfParse from 'pdf-parse';

export async function extrairEClassificarItensFatura(
  textoBruto: string,
  categoriasDisponiveis: Array<{ id: string; nome: string; tipo: string; grupo: string }>
): Promise<Array<{ itemDescricao: string; valor: number; data?: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean; grupoCategoria?: string }>> {
  
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  
  const MODEL_PRIMARY = process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.6-flash';
  const MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.5-flash-lite';
  
  if (!apiKey) {
    console.error('GEMINI_API_KEY não configurada no ambiente.');
    return [];
  }

  const prompt = `Você é um extrator de dados financeiros. Extraia as despesas/compras do texto bruto de uma fatura de cartão de crédito e classifique-as.
  
ATENÇÃO: O texto extraído do PDF pode estar "esmagado" sem espaços, por exemplo "03/03LOJA XPTO04/1225,87" (Data: 03/03, Loja: LOJA XPTO 04/12, Valor: 25,87). Use sua capacidade de dedução para separar corretamente a descrição do valor.
IGNORE pagamentos da própria fatura (ex: PAGTO ANTECIPADO, REVERSAO SALDO, PAGAMENTO EM LOTERICA), resumos, e saldos anteriores. Só extraia despesas, tarifas e encargos válidos.

Categorias disponíveis:
${JSON.stringify(categoriasDisponiveis, null, 2)}

Retorne APENAS um JSON válido contendo um array de objetos, onde cada objeto tem:
- "itemDescricao": string (o nome limpo da compra)
- "valor": number (o valor da compra, como número positivo. Converta centavos corretamente)
- "data": string (data no formato AAAA-MM-DD, se descobrir. Se não, omita)
- "categoriaId": string (se encontrar uma categoria existente correspondente)
- "categoriaNome": string (nome da categoria encontrada ou o nome de uma nova categoria sugerida)
- "categoriaNova": boolean (true se você sugeriu uma categoria que não estava na lista)
- "parcelaAtual": number (ex: se a descrição for "COMPRA 04/12", extraia 4)
- "totalParcelas": number (ex: se a descrição for "COMPRA 04/12", extraia 12)

Texto bruto da fatura:
${textoBruto.substring(0, 30000)}
  `;

  const fetchGemini = async (model: string) => {
    const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API (${model}): ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      return JSON.parse(text);
    }
    throw new Error('Resposta vazia');
  };

  try {
    return await fetchGemini(MODEL_PRIMARY);
  } catch (error) {
    console.warn(`Falha ao usar modelo primário (${MODEL_PRIMARY}). Tentando fallback...`, error);
    try {
      return await fetchGemini(MODEL_FALLBACK);
    } catch (fallbackError) {
      console.error(`Falha no modelo de fallback (${MODEL_FALLBACK}):`, fallbackError);
    }
  }

  return [];
}

export async function extrairTextoPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Erro ao extrair PDF:', error);
    throw new Error('Falha ao processar o arquivo PDF');
  }
}
