export function designConfig(env = {}) {
  return {
    key:env.OPENAI_API_KEY, accessCode:env.REALROOM_DESIGN_ACCESS_CODE,
    model:env.REALROOM_MODEL || 'gpt-6-astra',
    furnishingURL:env.REALROOM_FURNISHING_URL, furnishingKey:env.REALROOM_FURNISHING_KEY,
    hfToken:env.REALROOM_HF_TOKEN,
  };
}
