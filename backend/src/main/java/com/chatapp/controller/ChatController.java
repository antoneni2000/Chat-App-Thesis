package com.chatapp.controller;

import com.chatapp.dto.ChatDto;
import com.chatapp.dto.CreateGroupRequest;
import com.chatapp.dto.MessageDto;
import com.chatapp.dto.SendMessageDto;
import com.chatapp.entity.User;
import com.chatapp.security.SecurityUtils;
import com.chatapp.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final SecurityUtils securityUtils;
    private final SimpMessagingTemplate messagingTemplate;

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
     * POST /api/chats/groups — creeaza un grup nou.
     */
    @PostMapping("/groups")
    public ChatDto createGroup(@Valid @RequestBody CreateGroupRequest req) {
        return chatService.createGroup(securityUtils.getCurrentUser(), req.name(), req.memberIds());
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
     * Parametri optionali:
     *   ?before=<msgId>  — paginare cursor (mesaje mai vechi decat msgId)
     *   ?limit=<n>       — cate mesaje (default 200, cap 500)
     */
    @GetMapping("/{chatId}/messages")
    public List<MessageDto> getMessages(@PathVariable Long chatId,
                                        @RequestParam(value = "before", required = false) Long before,
                                        @RequestParam(value = "limit",  required = false, defaultValue = "200") Integer limit) {
        return chatService.getMessages(securityUtils.getCurrentUser(), chatId, before, limit);
    }

    /**
     * DELETE /api/chats/{id} — sterge un chat (soft-delete pentru user-ul curent).
     */
    @DeleteMapping("/{chatId}")
    public Map<String, Object> deleteChat(@PathVariable Long chatId) {
        chatService.deleteChat(securityUtils.getCurrentUser(), chatId);
        return Map.of("deleted", true, "chatId", chatId);
    }

    /**
     * POST /api/chats/{id}/read — marcheaza chatul ca citit pana acum.
     */
    @PostMapping("/{chatId}/read")
    public Map<String, Object> markAsRead(@PathVariable Long chatId) {
        chatService.markAsRead(securityUtils.getCurrentUser(), chatId);
        return Map.of("ok", true);
    }

    /**
     * POST /api/chats/{id}/messages — trimite mesaj via REST (pentru atasamente mari).
     * Salveaza si broadcast-eaza pe /topic/chat/{id}.
     */
    @PostMapping("/{chatId}/messages")
    public MessageDto sendMessageRest(@PathVariable Long chatId, @RequestBody SendMessageDto body) {
        User sender = securityUtils.getCurrentUser();
        MessageDto saved = chatService.sendMessage(
                sender, chatId, body.content(),
                body.attachmentUrl(), body.attachmentName(), body.attachmentType());
        messagingTemplate.convertAndSend("/topic/chat/" + chatId, saved);
        return saved;
    }
}
