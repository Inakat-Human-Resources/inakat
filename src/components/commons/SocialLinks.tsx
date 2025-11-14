import React from "react";
import { MessageCircle, Linkedin, Instagram, Facebook } from "lucide-react";
import { cn } from "@/lib/utils";

const iconStyles =
  "w-16 h-16 bg-custom-beige rounded-full flex items-center justify-center hover:bg-gray-300";
const iconSize = "text-button-green w-8 h-8";

const SocialLinks = () => {
  return (
    <div className="flex justify-center gap-6">
      <a
        href="https://wa.me/5200000000"
        target="_blank"
        rel="noopener noreferrer"
        className={iconStyles}
      >
        <MessageCircle className={iconSize} />
      </a>
      <a
        href="https://www.linkedin.com"
        target="_blank"
        rel="noopener noreferrer"
        className={iconStyles}
      >
        <Linkedin className={iconSize} />
      </a>
      <a
        href="https://www.instagram.com"
        target="_blank"
        rel="noopener noreferrer"
        className={iconStyles}
      >
        <Instagram className={iconSize} />
      </a>
      <a
        href="https://www.facebook.com"
        target="_blank"
        rel="noopener noreferrer"
        className={iconStyles}
      >
        <Facebook className={iconSize} />
      </a>
    </div>
  );
};

export default SocialLinks;
