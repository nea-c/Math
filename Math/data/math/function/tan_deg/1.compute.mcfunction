data modify storage math: internal.x set compute default float {"type":"mul","inputs":[{"type":"storage","storage":"math:","path":"a"},0.01745329251994329576923690768489]}
execute if data storage math: internal{x:0.0f} run return run data modify storage math: ans set from storage math: a
data modify storage math: ans set compute default float math:tan
