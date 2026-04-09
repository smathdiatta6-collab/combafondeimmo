import { MessageCircle } from 'lucide-react';

export default function WhatsAppButton() {
  const phone = "221775519683";
  const url = `https://wa.me/${phone}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-2xl z-50 hover:scale-110 transition-transform flex items-center gap-2 group"
    >
      <MessageCircle size={24} />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap font-medium">
        Chattez avec nous
      </span>
    </a>
  );
}
