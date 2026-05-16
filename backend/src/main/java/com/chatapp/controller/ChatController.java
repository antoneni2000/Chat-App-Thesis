package com.chatapp.controller;

import com.chatapp.dto.ChatDto;
import com.chatapp.dto.MessageDto;
import com.chatapp.security.SecurityUtils;
import com.chatapp.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final SecurityUtils securityUtils;

    /**
     * POST /api/chats/direct  body: { "otherUserId": 2 }
     * Găsește sau creează un chat 1-la-1 cu un alt user.
     */
    @PostMapping("/direct")
    public ChatDto createOrFindDirect(@RequestBody Map<String, Long> body) {
        Long otherUserId = body.get("otherUserId");
        return chatService.findOrCreateDirectChat(securityUtils.getCurrentUser(), otherUserId);
    }

    /**
     * GET /api/chats — toate chat-urile mele.
     */
    @GetMapping
    public List<ChatDto> listMyChats() {
        return chatService.listMyChats(securityUtils.getCurrentUser());
    }

    /**
     * GET /api/chats/{id}/messages — istoricul de mesaje al unui chat.
     */
    @GetMapping("/{chatId}/messages")
    public List<MessageDto> getMessages(@PathVariable Long chatId) {
        return chatService.getMessages(securityUtils.getCurrentUser(), chatId);
    }
}
