package com.chatapp.controller;

import com.chatapp.dto.AuthResponse;
import com.chatapp.dto.GoogleLoginRequest;
import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.JwtUtil;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    @Value("${app.google.client-id:}")
    private String googleClientId;

    /**
     * POST /api/auth/register — clasic email + parola
     */
    private static int countMetCriteria(String password) {
        int count = 0;
        if (password.length() >= 6) count++;
        if (password.chars().anyMatch(Character::isUpperCase)) count++;
        if (password.chars().anyMatch(Character::isLowerCase)) count++;
        if (password.chars().anyMatch(Character::isDigit)) count++;
        String specials = "!@#$%^&*()-_+=[]{}|;':\",./<>?\\";
        if (password.chars().anyMatch(c -> specials.indexOf(c) >= 0)) count++;
        return count;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (countMetCriteria(req.password()) < 3) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Parola trebuie să îndeplinească cel puțin 3 din 5 criterii: minim 6 caractere, literă mare, literă mică, cifră, caracter special (!@#$...)"));
        }
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
        }
        if (userRepository.existsByUsername(req.username())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
        }

        User u = User.builder()
                .username(req.username())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .displayName(req.displayName() != null && !req.displayName().isBlank()
                        ? req.displayName() : req.username())
                .build();

        u = userRepository.save(u);

        String token = jwtUtil.generateToken(u.getEmail());
        return ResponseEntity.ok(new AuthResponse(
                token, u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(), u.getAvatarUrl()));
    }

    /**
     * POST /api/auth/login — clasic email + parola
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        User u = userRepository.findByEmail(req.identifier())
                .or(() -> userRepository.findByUsername(req.identifier()))
                .orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Email/username sau parolă incorectă"));
        }
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(u.getEmail(), req.password()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Email/username sau parolă incorectă"));
        }
        String token = jwtUtil.generateToken(u.getEmail());
        return ResponseEntity.ok(new AuthResponse(
                token, u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(), u.getAvatarUrl()));
    }

    /**
     * POST /api/auth/google — login/register cu Google OAuth.
     * Frontend trimite ID-ul JWT primit de la Google (Google Identity Services).
     * Backend verifica semnatura, extrage email + nume + poza, creeaza/gaseste user, returneaza JWT-ul nostru.
     */
    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@Valid @RequestBody GoogleLoginRequest req) {
        if (googleClientId == null || googleClientId.isBlank()) {
            return ResponseEntity.status(500).body(Map.of("error",
                    "Google Sign-In not configured. Set app.google.client-id in application.properties"));
        }

        try {
            // 1. Verifica ID Token-ul Google
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(req.idToken());
            if (idToken == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid Google token"));
            }

            // 2. Extrage info din payload
            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            Boolean emailVerified = payload.getEmailVerified();
            String name = (String) payload.get("name");
            String picture = (String) payload.get("picture");

            if (Boolean.FALSE.equals(emailVerified)) {
                return ResponseEntity.status(401).body(Map.of("error", "Google email not verified"));
            }

            // 3. Gaseste sau creeaza user
            User user = userRepository.findByEmail(email).orElseGet(() -> {
                // username unic din email (partea inainte de @)
                String baseUsername = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "_");
                String username = baseUsername;
                int counter = 1;
                while (userRepository.existsByUsername(username)) {
                    username = baseUsername + counter++;
                }
                return userRepository.save(User.builder()
                        .username(username)
                        .email(email)
                        .displayName(name != null && !name.isBlank() ? name : username)
                        .avatarUrl(picture)
                        // passwordHash ramane null — user OAuth, nu se poate loga cu parola
                        .build());
            });

            // 4. Actualizeaza avatarul cu cel de la Google daca userul nu are
            if ((user.getAvatarUrl() == null || user.getAvatarUrl().isBlank()) && picture != null) {
                user.setAvatarUrl(picture);
                user = userRepository.save(user);
            }

            // 5. Genereaza JWT-ul nostru
            String token = jwtUtil.generateToken(user.getEmail());
            return ResponseEntity.ok(new AuthResponse(
                    token, user.getId(), user.getUsername(), user.getEmail(), user.getDisplayName(), user.getAvatarUrl()));

        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Google authentication failed: " + e.getMessage()));
        }
    }
}
