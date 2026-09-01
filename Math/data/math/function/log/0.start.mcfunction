data remove storage math: ans
data modify storage math: internal.x set from storage math: a
function math:.common/log/0.start
data modify storage math: ans set compute default float math:.common/input/x
data remove storage math: internal
