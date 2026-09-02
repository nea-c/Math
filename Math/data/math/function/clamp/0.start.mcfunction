data remove storage math: ans
data modify storage math: ans set compute default float {"type":"min","inputs":[{"type":"max","inputs":[{"type":"storage","storage":"math:","path":"a"},{"type":"storage","storage":"math:","path":"min"}]},{"type":"storage","storage":"math:","path":"max"}]}
data remove storage math: internal
