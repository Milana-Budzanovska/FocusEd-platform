
export async function sendInteraction(interactionData) {
  try {
    const response = await fetch('http://localhost:3001/interaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(interactionData)
    });

    const result = await response.json();
    console.log('✅ Interaction saved:', result);
  } catch (error) {
    console.error('❌ Error saving interaction:', error);
  }
}
