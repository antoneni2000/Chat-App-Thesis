package com.chatapp.security;

import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Spring Security foloseste clasa asta pentru a gasi userul dupa ce decodeaza JWT-ul.
 * Cautam in DB dupa email si returnam un "UserDetails".
 * Pentru useri OAuth (Google), password_hash e null — punem un placeholder care nu va fi folosit niciodata.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        // Pentru useri OAuth fara parola locala, folosim un placeholder.
        // JwtAuthFilter foloseste doar username + authorities; nu compara parole.
        String passwordForSpring = u.getPasswordHash() != null
                ? u.getPasswordHash()
                : "{noop}OAUTH_USER_NO_LOCAL_PASSWORD";

        return new org.springframework.security.core.userdetails.User(
                u.getEmail(),
                passwordForSpring,
                Collections.emptyList()
        );
    }
}
