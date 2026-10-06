// Account NFTs expose an asynchronous get_nft_data extension; standard TEP-62
// get_nft_data is a getter and cannot be called by another contract.
// Collection registration prevents a caller-created fake item from claiming a
// whitelisted collection. No wallet/oracle can set an NFT owner here.
import "@stdlib/deploy";
message RegisterAccountItem { nft_address: Address; }
message RefreshAccountOwner { nft_address: Address; target: Address; }
message(0x474e4644) QueryAccountNFTData { query_id: Int as uint64; }
message(0x4e464452) AccountNFTData {
    query_id: Int as uint64;
    collection: Address;
    owner: Address;
}
message ResolveNFTOwner { nft_address: Address; owner: Address; }
message CleanupOwnerQuery { nft_address: Address; }
struct PendingOwnerQuery {
    query_id: Int as uint64;
    target: Address;
    expires_at: Int as uint32;
}
contract VerifiedNFTAccountResolver with Deployable {
    collection_7777: Address;
    collection_8888: Address;
    items: map<Address, Address>;
    pending: map<Address, PendingOwnerQuery>;
    next_query: Int as uint64;
    pending_count: Int as uint16;
    init(collection_7777: Address, collection_8888: Address) {
        self.collection_7777 = collection_7777;
        self.collection_8888 = collection_8888;
        self.next_query = 0;
        self.pending_count = 0;
    }
    receive(msg: RegisterAccountItem) {
        require(sender() == self.collection_7777 || sender() == self.collection_8888, "Only whitelisted collection");
        require(self.items.get(msg.nft_address) == null, "Item already registered");
        self.items.set(msg.nft_address, sender());
    }
    receive(msg: RefreshAccountOwner) {
        require(self.items.get(msg.nft_address) != null, "Unknown account NFT");
        let previous: PendingOwnerQuery? = self.pending.get(msg.nft_address);
        if (previous != null) {
            require(previous!!.expires_at <= now(), "Owner query already pending");
        } else {
            require(self.pending_count < 64, "Owner query capacity reached");
            self.pending_count = self.pending_count + 1;
        }
        let query: Int = self.next_query;
        self.next_query = query + 1;
        self.pending.set(msg.nft_address, PendingOwnerQuery{query_id:query,target:msg.target,expires_at:now()+300});
        send(SendParameters{to:msg.nft_address,value:0,mode:SendRemainingValue,bounce:true,
            body:QueryAccountNFTData{query_id:query}.toCell()});
    }
    receive(msg: AccountNFTData) {
        let pending: PendingOwnerQuery? = self.pending.get(sender());
        require(pending != null, "Unsolicited owner callback");
        let request: PendingOwnerQuery = pending!!;
        require(msg.query_id == request.query_id, "Stale owner callback");
        require(now() < request.expires_at, "Owner callback expired");
        let collection: Address? = self.items.get(sender());
        require(collection != null && msg.collection == collection!!, "Collection mismatch");
        self.pending.del(sender());
        self.pending_count = self.pending_count - 1;
        send(SendParameters{to:request.target,value:0,mode:SendRemainingValue,bounce:true,
            body:ResolveNFTOwner{nft_address:sender(),owner:msg.owner}.toCell()});
    }
    bounced(msg: QueryAccountNFTData) {
        let request: PendingOwnerQuery? = self.pending.get(sender());
        if (request != null && request!!.query_id == msg.query_id) {
            self.pending.del(sender()); self.pending_count = self.pending_count - 1;
        }
    }
    receive(msg: CleanupOwnerQuery) {
        let request: PendingOwnerQuery? = self.pending.get(msg.nft_address);
        if (request != null) {
            require(request!!.expires_at <= now(), "Query not expired");
            self.pending.del(msg.nft_address); self.pending_count = self.pending_count - 1;
        }
    }
    get fun getCollection7777(): Address { return self.collection_7777; }
    get fun getCollection8888(): Address { return self.collection_8888; }
    get fun getPendingCount(): Int { return self.pending_count; }
}
