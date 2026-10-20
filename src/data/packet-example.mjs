import demo from './demo.json' with { type: 'json' };

// Uses only the publicly available screen-review prompt, never paid content.
const context = {
  '[SCREEN / FEATURE]': 'lesson-request form',
  '[APP NAME]': 'Maple Music, a fictional lesson-booking app',
  '[TARGET USER]': 'adults booking their first music lesson on a phone',
  '[WHAT THE USER SHOULD ACCOMPLISH]': 'request a preferred lesson time and understand that the school must confirm availability',
  "[DESCRIBE IT, OR WRITE 'UNKNOWN']": 'Two equally prominent buttons say Submit and Next. The form does not explain whether sending it confirms a booking. Keep the current fields and request process.',
};
export const packetExamplePrompt = Object.entries(context).reduce((text,[from,to])=>text.split(from).join(to),demo.prompts.find(prompt=>prompt.id===1).prompt);
