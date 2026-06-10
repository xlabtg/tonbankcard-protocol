trait IProbe {
    abstract get fun getFoo(): Int;
}

contract Probe with IProbe {
    v: Int as uint8;
    init() { self.v = 0; }
    override get fun getFoo(): Int { return self.v; }
}
