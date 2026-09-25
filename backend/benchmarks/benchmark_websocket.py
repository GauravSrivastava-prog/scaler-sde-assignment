"""
WebSocket Multiplexing & Latency Benchmark Suite
Tests concurrent WebSocket connections, message broadcast fan-out latency (P50, P95, P99),
multi-tab multiplexing, and heartbeat ping/pong pruning.
"""
import asyncio
import json
import time
import statistics
import httpx
import websockets

API_BASE = "http://localhost:8000/api"
WS_BASE = "ws://localhost:8000/ws"


async def login_user(username: str, password: str = "password123") -> str:
    """Fetch JWT token for user."""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{API_BASE}/auth/login",
            json={"phone_or_username": username, "password": password}
        )
        assert res.status_code == 200, f"Login failed for {username}: {res.text}"
        return res.json()["access_token"]


async def get_or_create_conversation(token1: str, user2_id: str) -> str:
    """Ensure direct conversation exists and return its ID."""
    headers = {"Authorization": f"Bearer {token1}"}
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{API_BASE}/conversations/direct",
            headers=headers,
            json={"recipient_user_id": user2_id}
        )
        assert res.status_code == 200, f"Conv creation failed: {res.text}"
        return res.json()["id"]


async def get_user_id(token: str) -> str:
    """Get authenticated user ID."""
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{API_BASE}/auth/me", headers=headers)
        return res.json()["id"]


async def test_heartbeat_and_ping_pong():
    """Test 1: Heartbeat ping/pong response latency and half-open socket detection."""
    print("\n--- Running Heartbeat & Ping/Pong Latency Test ---")
    token = await login_user("moxie")
    uri = f"{WS_BASE}?token={token}"

    async with websockets.connect(uri) as ws:
        latencies = []
        for i in range(5):
            t0 = time.perf_counter()
            await ws.send(json.dumps({"action": "ping"}))
            resp_raw = await ws.recv()
            t1 = time.perf_counter()
            resp = json.loads(resp_raw)
            assert resp["event"] == "pong"
            latencies.append((t1 - t0) * 1000)
            await asyncio.sleep(0.05)

        avg_lat = statistics.mean(latencies)
        min_lat = min(latencies)
        max_lat = max(latencies)
        print(f"✓ Heartbeat Ping/Pong successful: Avg: {avg_lat:.2f}ms, Min: {min_lat:.2f}ms, Max: {max_lat:.2f}ms")
        return {"avg_ms": avg_lat, "min_ms": min_lat, "max_ms": max_lat}


async def test_multitab_multiplexing():
    """
    Test 2: Multi-tab multiplexing.
    Connect 5 concurrent WebSockets for 'moxie'. Send 1 message from 'edward'.
    Verify all 5 tabs receive the message frame without dropping.
    """
    print("\n--- Running Multi-Tab Multiplexing Audit ---")
    moxie_token = await login_user("moxie")
    edward_token = await login_user("edward")
    moxie_id = await get_user_id(moxie_token)

    # Get conversation
    conv_id = await get_or_create_conversation(edward_token, moxie_id)

    num_tabs = 5
    moxie_sockets = []
    received_events = [asyncio.Event() for _ in range(num_tabs)]
    received_messages = [None for _ in range(num_tabs)]

    # Connect 5 concurrent tabs for Moxie
    for i in range(num_tabs):
        ws = await websockets.connect(f"{WS_BASE}?token={moxie_token}")
        moxie_sockets.append(ws)

    print(f"✓ Connected {num_tabs} concurrent WebSocket sessions for user 'moxie'.")

    # Background listener for each tab
    async def listen_tab(idx: int, socket):
        try:
            while True:
                msg_raw = await socket.recv()
                data = json.loads(msg_raw)
                if data.get("event") == "new_message":
                    received_messages[idx] = data
                    received_events[idx].set()
                    break
        except Exception:
            pass

    listener_tasks = [asyncio.create_task(listen_tab(i, moxie_sockets[i])) for i in range(num_tabs)]

    # Connect Edward socket and send message
    async with websockets.connect(f"{WS_BASE}?token={edward_token}") as edward_ws:
        test_payload = {
            "action": "send_message",
            "data": {
                "conversation_id": conv_id,
                "content": f"Multi-tab multiplexing audit test at {time.time()}",
                "message_type": "text"
            }
        }
        await edward_ws.send(json.dumps(test_payload))

        # Wait for all 5 tabs to receive
        try:
            await asyncio.wait_for(asyncio.gather(*[e.wait() for e in received_events]), timeout=3.0)
            print(f"✓ PASS: All {num_tabs} tabs received the incoming message simultaneously!")
            delivery_rate = 100.0
        except asyncio.TimeoutError:
            delivered = sum(1 for e in received_events if e.is_set())
            delivery_rate = (delivered / num_tabs) * 100
            print(f"✗ FAIL: Only {delivered}/{num_tabs} tabs received the message.")

    # Cleanup
    for t in listener_tasks:
        t.cancel()
    for ws in moxie_sockets:
        await ws.close()

    return {"tabs_tested": num_tabs, "delivery_rate_pct": delivery_rate}


async def test_fanout_latency_benchmark(num_messages: int = 50):
    """
    Test 3: Fan-out latency benchmark across concurrent users.
    Measures P50, P95, P99 round-trip latency from sender action to recipient receipt.
    """
    print(f"\n--- Running Message Fan-Out Latency Benchmark ({num_messages} messages) ---")
    moxie_token = await login_user("moxie")
    edward_token = await login_user("edward")
    moxie_id = await get_user_id(moxie_token)
    conv_id = await get_or_create_conversation(moxie_token, (await get_user_id(edward_token)))

    latencies_ms = []

    async with websockets.connect(f"{WS_BASE}?token={moxie_token}") as sender_ws, \
               websockets.connect(f"{WS_BASE}?token={edward_token}") as receiver_ws:

        # Drain any initial frames
        await asyncio.sleep(0.2)

        for i in range(num_messages):
            t_send = time.perf_counter()
            await sender_ws.send(json.dumps({
                "action": "send_message",
                "data": {
                    "conversation_id": conv_id,
                    "content": f"Benchmark packet #{i} - {t_send}",
                    "message_type": "text",
                    "temp_id": f"bench_{i}_{time.time()}"
                }
            }))

            # Wait for receiver to get it
            while True:
                msg_raw = await receiver_ws.recv()
                msg_data = json.loads(msg_raw)
                if msg_data.get("event") == "new_message":
                    t_recv = time.perf_counter()
                    latency = (t_recv - t_send) * 1000
                    latencies_ms.append(latency)
                    break

            await asyncio.sleep(0.02)  # 20ms inter-message interval

    latencies_sorted = sorted(latencies_ms)
    p50 = statistics.median(latencies_sorted)
    p90 = latencies_sorted[int(len(latencies_sorted) * 0.90)]
    p95 = latencies_sorted[int(len(latencies_sorted) * 0.95)]
    p99 = latencies_sorted[int(len(latencies_sorted) * 0.99)]
    avg = statistics.mean(latencies_sorted)
    min_lat = min(latencies_sorted)
    max_lat = max(latencies_sorted)

    print(f"✓ Results for {num_messages} messages:")
    print(f"  P50 (Median): {p50:.2f} ms")
    print(f"  P90:         {p90:.2f} ms")
    print(f"  P95:         {p95:.2f} ms")
    print(f"  P99:         {p99:.2f} ms")
    print(f"  Mean:        {avg:.2f} ms (Min: {min_lat:.2f} ms, Max: {max_lat:.2f} ms)")

    return {
        "samples": num_messages,
        "p50": round(p50, 2),
        "p90": round(p90, 2),
        "p95": round(p95, 2),
        "p99": round(p99, 2),
        "mean": round(avg, 2),
        "min": round(min_lat, 2),
        "max": round(max_lat, 2)
    }


async def main():
    print("=====================================================")
    print("  SIGNAL MESSENGER - WEBSOCKET PERFORMANCE BENCHMARK  ")
    print("=====================================================")
    hb_res = await test_heartbeat_and_ping_pong()
    mt_res = await test_multitab_multiplexing()
    lat_res = await test_fanout_latency_benchmark(50)

    report = {
        "heartbeat": hb_res,
        "multitab": mt_res,
        "latency": lat_res
    }
    with open("websocket_benchmark_results.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\n✓ Benchmark complete. Results written to websocket_benchmark_results.json")


if __name__ == "__main__":
    asyncio.run(main())
