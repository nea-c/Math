data remove storage math: ans
data modify storage math: ans set compute default float {"type":"add","inputs":[{"type":"storage","storage":"math:","path":"a"},{"type":"mul","inputs":[{"type":"storage","storage":"math:","path":"t"},{"type":"sub","left":{"type":"storage","storage":"math:","path":"b"},"right":{"type":"storage","storage":"math:","path":"a"}}]}]}
data remove storage math: internal
