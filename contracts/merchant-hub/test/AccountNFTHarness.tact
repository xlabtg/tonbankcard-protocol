// Test-only interoperable NFT item: transferable owner and async resolver reply.
import "../../nft-resolver/VerifiedNFTAccountResolver.tact";
message TransferAccountHarness { owner: Address; }
contract AccountNFTHarness with Deployable {
    owner: Address;
    collection: Address;
    init(owner: Address, collection: Address) { self.owner = owner; self.collection = collection; }
    receive(msg: TransferAccountHarness) { require(sender() == self.owner, "Only NFT owner"); self.owner = msg.owner; }
    receive(msg: QueryAccountNFTData) {
        send(SendParameters{to:sender(),value:0,mode:SendRemainingValue,bounce:false,
            body:AccountNFTData{query_id:msg.query_id,collection:self.collection,owner:self.owner}.toCell()});
    }
}
