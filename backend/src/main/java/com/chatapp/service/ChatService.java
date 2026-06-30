package com.chatapp.service;

import com.chatapp.dto.ChatDto;
import com.chatapp.dto.MessageDto;
import com.chatapp.dto.UserDto;
import com.chatapp.entity.Chat;
import com.chatapp.entity.ChatMember;
import com.chatapp.entity.Message;
import com.chatapp.entity.MessageDeliveryStatus;
import com.chatapp.entity.User;
import com.chatapp.repository.ChatMemberRepository;
import com.chatapp.repository.ChatRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRepository chatRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final FileStorageService fileStorageService;

    /**
     * transforma o entitate Message in DTO si regenereaza Signed URL-ul pentru atasament
     */
    private MessageDto toDtoFreshUrl(Message m) {
        MessageDto dto = MessageDto.from(m);
        if (dto.attachmentUrl() == null || dto.attachmentUrl().isBlank()) return dto;
        return dto.withAttachmentUrl(fileStorageService.freshUrlFor(dto.attachmentUrl()));
    }

    /**
     * gaseste/creaza un chat direct, nu se notifica celalalt user de crearea chat-ului, doar atunci cand se trimite primul mesaj
     */
    @Transactional
    public ChatDto findOrCreateDirectChat(User currentUser, Long otherUserId) {
        if (currentUser.getId().equals(otherUserId)) {
            throw new IllegalArgumentException("Cannot start a chat with yourself");
        }

        User otherUser = userRepository.findById(otherUserId)
                .orElseThrow(() -> new IllegalArgumentException("Other user not found"));

        Chat existing = chatRepository.findDirectChatBetween(currentUser.getId(), otherUserId)
                .orElse(null);

        if (existing != null) {
            // reactiveaza pentru userul curent daca il sterse
            chatMemberRepository.findByChatIdAndUserId(existing.getId(), currentUser.getId())
                    .ifPresent(cm -> { cm.setDeletedAt(null); chatMemberRepository.save(cm); });
            return toDto(existing, currentUser);
        }

        Chat chat = Chat.builder()
                .type(Chat.ChatType.DIRECT)
                .build();
        chat = chatRepository.save(chat);

        // userul curent: chat-ul e deja "citit" (lastReadAt = now)
        ChatMember meAsMember = ChatMember.builder()
                .chat(chat).user(currentUser).lastReadAt(LocalDateTime.now())
                .build();
        chatMemberRepository.save(meAsMember);

        // celalalt: marcat ca DELETED, deci NU apare in sidebar pana la primul mesaj
        ChatMember otherAsMember = ChatMember.builder()
                .chat(chat).user(otherUser).deletedAt(LocalDateTime.now())
                .build();
        chatMemberRepository.save(otherAsMember);

        // notificam doar userul curent
        ChatDto forCurrent = toDto(chat, currentUser);
        messagingTemplate.convertAndSend("/topic/user/" + currentUser.getId() + "/chats", forCurrent);
        return forCurrent;
    }

    @Transactional(readOnly = true)
    public List<ChatDto> listMyChats(User currentUser) {
        return chatRepository.findVisibleChatsForUser(currentUser.getId())
                .stream()
                .map(c -> toDto(c, currentUser))
                .sorted((a, b) -> {
                    LocalDateTime ta = a.lastMessage() != null ? a.lastMessage().createdAt() : a.createdAt();
                    LocalDateTime tb = b.lastMessage() != null ? b.lastMessage().createdAt() : b.createdAt();
                    return tb.compareTo(ta);  // descrescator: cel mai recent primul
                })
                .toList();
    }

    /**
     * creeaza un grup cu nume + membri.
     * cine creaza grupul, userul care creaza grup, e adaugat automat.
     * toti membrii primesc chatul instant in sidebar.
     */
    @Transactional
    public ChatDto createGroup(User creator, String name, java.util.List<Long> memberIds) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Group name required");
        }
        // unique set: creator + alti membri
        java.util.Set<Long> uniqueIds = new java.util.LinkedHashSet<>();
        uniqueIds.add(creator.getId());
        if (memberIds != null) uniqueIds.addAll(memberIds);
        if (uniqueIds.size() < 2) {
            throw new IllegalArgumentException("Group needs at least 2 members");
        }

        Chat chat = Chat.builder()
                .type(Chat.ChatType.GROUP)
                .name(name.trim())
                .build();
        chat = chatRepository.save(chat);

        for (Long uid : uniqueIds) {
            User u = userRepository.findById(uid)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + uid));
            ChatMember cm = ChatMember.builder()
                    .chat(chat).user(u)
                    .lastReadAt(uid.equals(creator.getId()) ? LocalDateTime.now() : null)
                    .build();
            chatMemberRepository.save(cm);
        }

        // notifica toti membrii - apare in sidebar
        Chat finalChat = chat;
        uniqueIds.forEach(uid -> {
            User u = userRepository.findById(uid).orElse(null);
            if (u != null) {
                ChatDto cdto = toDto(finalChat, u);
                messagingTemplate.convertAndSend("/topic/user/" + uid + "/chats", cdto);
            }
        });

        return toDto(chat, creator);
    }

    /**
     * trimite mesaj. salveaza, broadcast la /topic/chat/{id}, si trimite update
     * de sidebar (cu lastMessage + unreadCount nou) la fiecare membru.
     */
    @Transactional
    public MessageDto sendMessage(User sender, Long chatId, String content,
                                  String attachmentUrl, String attachmentName, String attachmentType) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        List<ChatMember> members = chatMemberRepository.findByChatId(chatId);
        boolean isMember = members.stream().anyMatch(cm -> cm.getUser().getId().equals(sender.getId()));
        if (!isMember) {
            throw new IllegalArgumentException("You are not a member of this chat");
        }

        // salvam direct ca DELIVERED adica serverul a primit mesajul si urmeaza sa l distribuie
        // un singur save(), nu vrem sa existe existe race intre PENDING si  DELIVERED.
        LocalDateTime now = LocalDateTime.now();
        Message m = Message.builder()
                .chat(chat)
                .sender(sender)
                .content(content)
                .attachmentUrl(attachmentUrl)
                .attachmentName(attachmentName)
                .attachmentType(attachmentType)
                .deliveryStatus(MessageDeliveryStatus.DELIVERED)
                .deliveredAt(now)
                .build();
        m = messageRepository.save(m);
        MessageDto dto = toDtoFreshUrl(m);

        // broadcast-ul pe /topic/chat/{id} se face in ChatWebSocketController.
        // doar trimitem update-uri user-level (sidebar) pentru fiecare membru.
        for (ChatMember cm : members) {
            boolean changed = false;
            if (cm.getDeletedAt() != null) {
                cm.setDeletedAt(null);
                changed = true;
            }
            if (cm.getUser().getId().equals(sender.getId())) {
                cm.setLastReadAt(LocalDateTime.now());
                changed = true;
            }
            if (changed) chatMemberRepository.save(cm);

            // re-read din DB pentru valori actualizate
            ChatDto cdto = toDto(chat, cm.getUser());
            messagingTemplate.convertAndSend("/topic/user/" + cm.getUser().getId() + "/chats", cdto);
        }

        return dto;
    }

    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(User currentUser, Long chatId) {
        return getMessages(currentUser, chatId, null, 200);
    }

    /**
     * cele mai recente {limit} mesaje, optional inainte de un msgId
     * teturneaza in ordine cronologica (cel mai vechi primul), !frontend-ul nu trebuie sa inverseze.
     */
    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(User currentUser, Long chatId, Long beforeId, int limit) {
        if (!chatMemberRepository.existsByChatIdAndUserId(chatId, currentUser.getId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "You are not a member of this chat");
        }

        // capped ca sa nu sufoce serverul daca cineva trimite limit=99999
        int capped = Math.min(Math.max(limit, 1), 500);
        org.springframework.data.domain.Pageable page =
                org.springframework.data.domain.PageRequest.of(0, capped);

        List<Message> rows = (beforeId == null)
                ? messageRepository.findRecentByChatId(chatId, page)
                : messageRepository.findByChatIdBefore(chatId, beforeId, page);

        // intoarcem in ordine crescatoare (cel mai vechi primul) ca sa fie rendable direct
        java.util.List<Message> ordered = new java.util.ArrayList<>(rows);
        ordered.sort(java.util.Comparator.comparing(Message::getCreatedAt));
        return ordered.stream().map(this::toDtoFreshUrl).toList();
    }

    @Transactional
    public void markAsRead(User currentUser, Long chatId) {
        ChatMember cm = chatMemberRepository.findByChatIdAndUserId(chatId, currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not a member"));
        LocalDateTime now = LocalDateTime.now();
        cm.setLastReadAt(now);
        chatMemberRepository.save(cm);

        // BULK UPDATE intr-un singur query (inlocuieste bucla N+1)
        int updated = messageRepository.bulkMarkAsRead(
                chatId, currentUser.getId(), MessageDeliveryStatus.READ, now);
        // (nu mai e nevoie sa iteram; updated = numarul de mesaje afectate)

        // notifica chat ul ca mesajele au fost citite =: sender-ul actualizeaza bifele.
        // Payload: { readerId, chatId, readAt } sender filtreaza propriile mesaje
        // create inainte de readAt si le marcheaza ca READ in UI.
        java.util.Map<String, Object> readReceipt = new java.util.HashMap<>();
        readReceipt.put("readerId", currentUser.getId());
        readReceipt.put("chatId", chatId);
        readReceipt.put("readAt", now);
        messagingTemplate.convertAndSend("/topic/chat/" + chatId + "/read", readReceipt);

        // trimite update de sidebar (unreadCount va fi 0 acum)
        ChatDto cdto = toDto(cm.getChat(), currentUser);
        messagingTemplate.convertAndSend("/topic/user/" + currentUser.getId() + "/chats", cdto);
    }

    @Transactional
    public void deleteChat(User currentUser, Long chatId) {
        ChatMember cm = chatMemberRepository.findByChatIdAndUserId(chatId, currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("You are not a member of this chat"));
        cm.setDeletedAt(LocalDateTime.now());
        chatMemberRepository.save(cm);
        messagingTemplate.convertAndSend("/topic/user/" + currentUser.getId() + "/chats/deleted", chatId);
    }


    private ChatDto toDto(Chat chat, User currentUser) {
        List<ChatMember> members = chatMemberRepository.findByChatId(chat.getId());
        List<UserDto> memberDtos = members.stream()
                .map(cm -> UserDto.from(cm.getUser()))
                .toList();

        MessageDto lastMsg = messageRepository
                .findFirstByChatIdAndDeletedFalseOrderByCreatedAtDesc(chat.getId())
                .map(this::toDtoFreshUrl)
                .orElse(null);

        long unread = 0;
        ChatMember myMembership = members.stream()
                .filter(cm -> cm.getUser().getId().equals(currentUser.getId()))
                .findFirst().orElse(null);
        if (myMembership != null) {
            if (myMembership.getLastReadAt() == null) {
                unread = messageRepository.countByChatIdAndDeletedFalseAndSenderIdNot(chat.getId(), currentUser.getId());
            } else {
                unread = messageRepository.countByChatIdAndDeletedFalseAndCreatedAtAfterAndSenderIdNot(
                        chat.getId(), myMembership.getLastReadAt(), currentUser.getId());
            }
        }

        if (chat.getType() == Chat.ChatType.DIRECT) {
            UserDto other = memberDtos.stream()
                    .filter(u -> !u.id().equals(currentUser.getId()))
                    .findFirst()
                    .orElse(null);
            return ChatDto.direct(chat, other, memberDtos, lastMsg, unread);
        } else {
            return ChatDto.group(chat, memberDtos, lastMsg, unread);
        }
    }
}

