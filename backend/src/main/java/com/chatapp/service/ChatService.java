package com.chatapp.service;

import com.chatapp.dto.ChatDto;
import com.chatapp.dto.MessageDto;
import com.chatapp.dto.UserDto;
import com.chatapp.entity.Chat;
import com.chatapp.entity.ChatMember;
import com.chatapp.entity.Message;
import com.chatapp.entity.User;
import com.chatapp.repository.ChatMemberRepository;
import com.chatapp.repository.ChatRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRepository chatRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    /**
     * gaseste , creeaza chat direct 2 useri
     */
    @Transactional
    public ChatDto findOrCreateDirectChat(User currentUser, Long otherUserId) {
        if (currentUser.getId().equals(otherUserId)) {
            throw new IllegalArgumentException("Cannot start a chat with yourself");
        }

        User otherUser = userRepository.findById(otherUserId)
                .orElseThrow(() -> new IllegalArgumentException("Other user not found"));

        // cauta daca exista deja chat intre cei 2
        Chat existing = chatRepository.findDirectChatBetween(currentUser.getId(), otherUserId)
                .orElse(null);

        if (existing != null) {
            return toDto(existing, currentUser);
        }

        // daca nu, creeaza unul nou
        Chat chat = Chat.builder()
                .type(Chat.ChatType.DIRECT)
                .build();
        chat = chatRepository.save(chat);

        chatMemberRepository.save(ChatMember.builder().chat(chat).user(currentUser).build());
        chatMemberRepository.save(ChatMember.builder().chat(chat).user(otherUser).build());

        return toDto(chat, currentUser);
    }

    /**
     * lista cu chaturi in care este si user curent
     */
    @Transactional(readOnly = true)
    public List<ChatDto> listMyChats(User currentUser) {
        List<Chat> chats = chatRepository.findAllByUserId(currentUser.getId());
        return chats.stream().map(c -> toDto(c, currentUser)).toList();
    }

    /**
     * salvare msaj intr un chat, daca e membru
     */
    @Transactional
    public MessageDto sendMessage(User sender, Long chatId, String content) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        if (!chatMemberRepository.existsByChatIdAndUserId(chatId, sender.getId())) {
            throw new IllegalArgumentException("You are not a member of this chat");
        }

        Message m = Message.builder()
                .chat(chat)
                .sender(sender)
                .content(content)
                .build();
        m = messageRepository.save(m);

        return MessageDto.from(m);
    }

    /**
     * return mesajele unui chat
     */
    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(User currentUser, Long chatId) {
        if (!chatMemberRepository.existsByChatIdAndUserId(chatId, currentUser.getId())) {
            throw new IllegalArgumentException("You are not a member of this chat");
        }
        return messageRepository.findByChatIdOrderByCreatedAtAsc(chatId)
                .stream().map(MessageDto::from).toList();
    }

    /**
     *chat -> chatDto dupa perspectiva user curent
     */
    private ChatDto toDto(Chat chat, User currentUser) {
        List<ChatMember> members = chatMemberRepository.findByChatId(chat.getId());
        List<UserDto> memberDtos = members.stream()
                .map(cm -> UserDto.from(cm.getUser()))
                .toList();

        if (chat.getType() == Chat.ChatType.DIRECT) {
            UserDto other = memberDtos.stream()
                    .filter(u -> !u.id().equals(currentUser.getId()))
                    .findFirst()
                    .orElse(null);
            return ChatDto.direct(chat, other, memberDtos);
        } else {
            return ChatDto.group(chat, memberDtos);
        }
    }
}
