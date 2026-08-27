package org.example.vartalap.listener;

import org.example.vartalap.model.ChatMessage;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class WebSocketEventListener {

    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        if (accessor.getSessionAttributes() == null) {
            return;
        }
        Object username = accessor.getSessionAttributes().get("username");
        Object roomId = accessor.getSessionAttributes().get("roomId");
        if (username == null || roomId == null) {
            return;
        }

        ChatMessage message = new ChatMessage();
        message.setType(ChatMessage.MessageType.LEAVE);
        message.setSender(String.valueOf(username));
        message.setRoomId(String.valueOf(roomId));
        message.setContent(username + " left the chat");
        message.setTimestamp(System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }
}

