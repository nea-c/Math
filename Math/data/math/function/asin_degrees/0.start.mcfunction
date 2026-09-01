data remove storage math: error
data remove storage math: ans
data modify storage math: internal.x set compute default float math:.common/input/a
function math:.common/asin/0.start
data modify storage math: internal.x set compute default float math:.common/deg
data modify storage math: ans set from storage math: internal.x
data remove storage math: internal
