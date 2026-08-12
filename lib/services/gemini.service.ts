import pdfParse from 'pdf-parse';

export async function classificarItensFatura(
  itens: Array<{ descricao: string; valor: number }>,
  categoriasDisponiveis: Array<{ id: string; nome: string; tipo: string; grupo: string }>
): Promise<Array<{ itemDescricao: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean; grupoCategoria?: string }>> {
  
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  
  if (!apiKey || process.env.GEMINI_ENABLED !== 'true') {
    return itens.map(item => ({
      itemDescricao: item.descricao,
      categoriaNome: 'Outros',
      categoriaNova: true
    }));
  }

  const prompt = `Classifique os seguintes itens de fatura de cartão de crédito nas categorias fornecidas.
  
Itens:
${JSON.stringify(itens, null, 2)}

Categorias disponíveis:
${JSON.stringify(categoriasDisponiveis, null, 2)}

Retorne APENAS um JSON válido contendo um array de objetos com "itemDescricao", "categoriaId" (se encontrada), "categoriaNome" (se for criar uma nova ou se encontrada) e "categoriaNova" (boolean).
  `;

  try {
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
      console.error('Erro Gemini API:', await response.text());
      return itens.map(i => ({ itemDescricao: i.descricao }));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error('Erro ao processar Gemini:', error);
  }

  return itens.map(i => ({ itemDescricao: i.descricao }));
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
