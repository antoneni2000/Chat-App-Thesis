package com.chatapp.security;

import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

/**
 * helper care îți dă userul curent (cel logat), citit din SecurityContext-ul Spring.
 * SecurityContext-ul a fost setat de JwtAuthFilter când a decodat token-ul.
 */
@Component
@RequiredArgsConstructor
public class SecurityUtils {

    private final UserRepository userRepository;

    public User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetails ud)) {
            throw new IllegalStateException("No authenticated user");
        }
        String email = ud.getUsername(); // username-ul din UserDetails = email-ul nostru
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Current user not found in DB"));
    }
}
