typedef struct Reader {
  int pos;
  const unsigned char *bytes;
  int length;
} Reader;

int decodeVLQ(Reader *reader);

void decode(Reader *reader);

extern void emitNewline();
extern void emitMapping1(int column);
extern void emitMapping4(int column, int source, int sourceLine, int sourceColumn);
extern void emitMapping5(int column, int source, int sourceLine, int sourceColumn, int name);
