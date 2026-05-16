package com.chatapp.controller;

import com.chatapp.dto.UserDto;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    /**
     * GET /api/users/me — userul curent (din token-ul JWT).
     */
    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(securityUtils.getCurrentUser());
    }

    /**
     * GET /api/users — toți userii, mai puțin eu însumi (ca să nu pot face chat cu mine).
     */
    @GetMapping
    public List<UserDto> listAll() {
        User me = securityUtils.getCurrentUser();
        return userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .map(UserDto::from)
                .toList();
    }
}
